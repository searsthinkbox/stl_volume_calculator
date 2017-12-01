const {ipcRenderer} = require('electron');
const THREE = require('three');
const STLLoader = require('three-stl-loader')(THREE);
const OrbitControls = require('three-orbit-controls')(THREE);

let files;

//sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    "<div id='file_pic_", i, "'> </div>",
    '</li>');
  }
  document.getElementById('file_list').innerHTML = '<ul>' + output.join('') + '</ul>'
    + '<input type="button" id="show_pics" value="Show Pictures of Selected Files"/>';
  document.getElementById('show_pics').addEventListener('click', handleShowPics, false);
}

//file drag and drop
function handleDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

//Show Pictures of Selected files
async function handleShowPics(event) {
  //set up
  var scenes = [];
  var cameras = [];
  var renderers = [];
  var meshes = [];
  var controls = [];
  var pointLights = [];
  var loader = new STLLoader();
  const CONTAINER_WIDTH = '600px';
  const CONTAINER_HEIGHT = '600px';

  for (var i = 0, file; file = files[i]; i++) {
    var container = document.getElementById('file_pic_' + i);
    container.style.width = CONTAINER_WIDTH;
    container.style.height = CONTAINER_HEIGHT;

    //set renderers
    renderers[i] = new THREE.WebGLRenderer();
    renderers[i].setSize(container.offsetWidth, container.offsetHeight);
    container.appendChild(renderers[i].domElement);

    //set scene
    scenes[i] = new THREE.Scene();
    scenes[i].background = new THREE.Color(0x333333);

    //set lights
    scenes[i].add(new THREE.AmbientLight(0xffffff, 0.3));
    pointLights[i] = new THREE.PointLight(0xffffff, 0.7, 0, 2);
    scenes[i].add(pointLights[i]);

    //add geometry
    var scene = scenes[i];
    var doneLoading = false;
    var boundingSphereRadius;
    loader.load(file.path, function (geometry) {
      geometry.center();
      geometry.computeBoundingSphere();
      boundingSphereRadius = geometry.boundingSphere.radius;
      scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: new THREE.Color(0xb1b1ff), metalness: 0.25})));
      doneLoading = true;
    });
    while (!doneLoading) {
      await sleep(50);
    }

    //set cameras
    cameras[i] = new THREE.PerspectiveCamera(35, container.offsetWidth / container.offsetHeight, 1, 500);
    cameras[i].up.set(0,0,1);
    cameras[i].position.set(-3*boundingSphereRadius, -3*boundingSphereRadius, 1.5*boundingSphereRadius);
    scenes[i].add(cameras[i]);

    //add controls
    controls[i] = new OrbitControls(cameras[i], renderers[i].domElement);
		controls[i].addEventListener('change', render);
		controls[i].minDistance = 1;
		controls[i].maxDistance = 3.5*boundingSphereRadius;
		controls[i].target.set(0, 0, 0);
		controls[i].update();

    render();
  }

  function render() {
    for (var i = 0; i < renderers.length; i++) {
      //match light position to camera position
      pointLights[i].position.x = cameras[i].getWorldPosition().x;
      pointLights[i].position.y = cameras[i].getWorldPosition().y;
      pointLights[i].position.z = cameras[i].getWorldPosition().z;

      renderers[i].render(scenes[i],cameras[i]);
    }
  }
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
        //warning for small or large volume
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
