const {app, BrowserWindow, ipcMain, Menu, shell, dialog} = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const readSTL = require('stl');
const math = require('mathjs');

let win;
let main_renderer;
let menu_template = [{
  label: 'File',
  submenu: [{
    label: 'Open STL File(s)',
    accelerator: 'CmdOrCtrl+O',
    click: function () {
      dialog.showOpenDialog({
        filters: [{name: '.stl', extensions: ['stl']}],
        properties: ['openFile', 'multiSelections']
      }, (fileNames) => {
        if (fileNames === undefined) {
          return;
        }
        main_renderer.send('open_file', fileNames);
      });
    }
  }, {
    label: 'Quit',
    accelerator: 'CmdOrCtrl+Q',
    click: function () {
      app.quit();
    }
  }]
}, {
  label: 'View',
  submenu: [{
    label: 'Reload',
    accelerator: 'CmdOrCtrl+R',
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        // close any old secondary windows
        if (focusedWindow.id === 1) {
          BrowserWindow.getAllWindows().forEach(function (win) {
            if (win.id > 1) {
              win.close();
            }
          });
        }
        focusedWindow.reload();
      }
    }
  }, {
    label: 'Toggle Full Screen',
    accelerator: (process.platform === 'darwin') ? 'Ctrl+Command+F' : 'F11',
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
      }
    }
  }, {
    label: 'Toggle Developer Tools',
    accelerator: (process.platform === 'darwin') ? 'Alt+Command+I' : 'Ctrl+Shift+I',
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.toggleDevTools();
      }
    }
  }]
}, {
  label: 'Window',
  role: 'window',
  submenu: [{
    label: 'Minimize',
    accelerator: 'CmdOrCtrl+M',
    role: 'minimize'
  }, {
    label: 'Close',
    accelerator: 'CmdOrCtrl+W',
    role: 'close'
  }]
}, {
  label: 'Help',
  role: 'help',
  submenu: [{
    label: 'think[box] FDM Printing',
    click: function () {
      shell.openExternal('http://thinkbox.case.edu/equipment/3dprinter/FDM#centerCol');
    }
  }, {
    label: 'think[box] PolyJet Printing',
    click: function () {
      shell.openExternal('http://thinkbox.case.edu/equipment/3dprinter/objet350');
    }
  }, {
    label: 'Version ' + app.getVersion(),
    enabled: false
  }]
}];

function addUpdateMenuItems(items, position) {
  if (process.mas) return;

  let updateItems = [{
    label: 'Version ${app.getVersion()}',
    enabled: false
  }, {
    label: 'Checking for Update',
    enabled: false,
    key: 'checkingForUpdate'
  }, {
    label: 'Check for Update',
    visible: false,
    key: 'checkForUpdate',
    click: function () {
      require('electron').autoUpdater.checkForUpdates();
    }
  }, {
    label: 'Restart and Install Update',
    enabled: true,
    visible: false,
    key: 'restartToUpdate',
    click: function () {
      require('electron').autoUpdater.quiteAndInstall();
    }
  }]

  items.splice.apply(items, [position, 0].concat(updateItems));
}

if (process.platform === 'darwin') {
  const name = election.app.getName();
  menu_template.unshift({
    label: name,
    submenu: [{
      label: 'About ${name}',
      role: 'about'
    }, {
      type: 'separator'
    }, {
      label: 'Services',
      role: 'services',
      submenu: []
    }, {
      type: 'separator'
    }, {
      label: 'Hide ${name}',
      accelerator: 'Command+H',
      role: 'hide'
    }, {
      label: 'Hide Others',
      accelerator: 'Command+Alt+H',
      role: 'hideothers'
    }, {
      label: 'Show All',
      role: 'unhide'
    }, {
      type: 'separator'
    }, {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: function () {
        app.quit();
      }
    }]
  });

  //Window menu
  menu_template[2].submenu.push({
    type: 'separator'
  }, {
    label: 'Bring All to Front',
    role: 'front'
  });

  addUpdateMenuItems(menu_template[0].submenu, 1);
}

if (process.platform === 'win32') {
  const helpMenu = menu_template[menu_template.length - 1].submenu;
  addUpdateMenuItems(helpMenu, 0);
}

function createWindow() {
  win = new BrowserWindow({width: 1000, height: 800});

  //load main page
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  //clean up
  win.on('closed', () => {
    win = null;
  });
}

//run after initiallization
app.on('ready', function () {
  const menu = Menu.buildFromTemplate(menu_template);
  Menu.setApplicationMenu(menu);
  createWindow();
});

//quit when all windows are closed
app.on('window-all-closed', () => {
  //required for macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  //required for macOS
  if (win === null) {
    createWindow();
  }
});

//get a route to the main window
ipcMain.once('callback', (event, message) => {
  main_renderer = event.sender;
});

//calculate STL volume
ipcMain.on('volume_calc', (event, file_list) => {
  var volumes = [];

  for (var i = 0, file; file = file_list[i]; i++) {
    console.log('File:' + file.file_path);
    var stl = readSTL.toObject(fs.readFileSync(file.file_path));
    var volume = 0;
    stl.facets.forEach(function(facet) {
      volume += math.det(facet.verts) / 6.0;
    });

    if (file.units === 'mm') {
      volume *= 0.0000610237;
    }
    volume = math.round(volume, 3);
    console.log(volume);
    volumes[i] = {
      name: file.name,
      volume: volume
    };
  }

  event.sender.send('volume_done', volumes);
});
