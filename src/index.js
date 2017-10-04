const {ipcRenderer} = require('electron');

let files;

window.onload = function () {
  //file load
  document.getElementById('files').addEventListener('change', handleFileSelect, false);

  //drag and drop
  document.getElementById('drop_zone').addEventListener('dragover', handleDragOver, false);
  document.getElementById('drop_zone').addEventListener('drop', handleFileSelect, false);

  //calculate STL volume
  document.getElementById('calc_volume').addEventListener('click', handleSTLCalc, false);

  //send message to main
  ipcRenderer.send('callback', 'this is a message to get a callback');

  //recieve file open
  ipcRenderer.on('open_file', function (event, file_paths) {
    var file_names = [];
    for (var i = 0; i < file_paths.length; i++) {
      var split_path = file_paths[i].split((navigator.platform === 'Win32') ?'\\':'/');
      file_names.push(split_path[split_path.length - 1]);
    }
    pushFileNamesToWindow(file_names);

    files = [];
    for (var i = 0; i < file_paths.length; i++) {
      files.push({
        name: file_names[i],
        path: file_paths[i]
      });
    }
  });
};

//file loading
function handleFileSelect(event) {
  event.stopPropagation();
  event.preventDefault();

  console.log('Receiving files');

  files = null;
  files = (event.target.files) ? event.target.files : event.dataTransfer.files;

  var file_names = [];
  for (var i = 0, file; file = files[i]; i++) {
    file_names.push(escape(file.name));
  }
  pushFileNamesToWindow(file_names);
}

function pushFileNamesToWindow(file_names) {
  var output = [];
  for (var i = 0, file_name; file_name = file_names[i]; i++) {
    output.push('<li>', file_name, '  ',
    "<select id='file_", i,
    "'> <option value='in'>in</option> <option value='mm'>mm</option> </select>",
    '</li>');
  }
  document.getElementById('file_list').innerHTML = '<ul>' + output.join('') + '</ul>';
}

//file drag and drop
function handleDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

//calculate STL Volume
function handleSTLCalc(event) {
  console.log('Calculating STL Volume');

  if(files) {
    console.log('Files found:\n' + files);
    document.body.style.cursor = 'wait';

    ipcRenderer.once('volume_done', (event, volumes) => {
      var output = 'Volumes\n<ul>';
      for (var i = 0; i < volumes.length; i++) {
        output += '<li>' + volumes[i].name + ' - ' +  volumes[i].volume + ' in<sup>3</sup>';
        if (volumes[i].volume < 1 || volumes[i].volume > 50) {
          output += "<br><img src='warning.svg' alt='Warning' style='height:15px;display:inline'> Warning: Your units may be wrong."
        }
        output += '</li>\n';
      }
      output += '</ul>';
      document.getElementById('stl_volume').innerHTML = output;
      document.body.style.cursor = 'default';
    });

    var file_list = [];
    for (var i = 0, file; file = files[i]; i++) {
      file_list[i] = {
        file_path: file.path,
        name: file.name,
        units: document.getElementById('file_' + i).value
      };
    }
    ipcRenderer.send('volume_calc', file_list);
  } else {
    console.log('File not found');
    alert('No STL files loaded!');
  }
}
