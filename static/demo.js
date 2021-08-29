let CamerasOrthographic = AMI.OrthographicCamera;
let ControlsOrthographic = AMI.TrackballOrthoControl;
let LoadersVolume = AMI.VolumeLoader;
let HelpersStack = AMI.StackHelper;
// standard global variables
let stats;
let ready = false;

let redContourHelper = null;
let redTextureTarget = null;
let redContourScene = null;

String.prototype.trimLeft = function(charlist) {
  if (charlist === undefined)
    charlist = "\s";

  return this.replace(new RegExp("^[" + charlist + "]+"), "");
};

const OverlayMasks = {
}


// 2d axial renderer
const r1 = {
  domId: 'r1',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'axial',
  sliceColor: 0x000000,
  targetID: 1,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  overlay_material: null,
  overlay_scene: null,
  overlay_plane: null,
  showOverlay: 1,
  trackingMouse: false,
  statdata: null,
};

const r2 = {
  domId: 'r2',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'axial',
  sliceColor: 0x000000,
  targetID: 2,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  overlay_material: null,
  overlay_scene: null,
  overlay_plane: null,
  showOverlay: 1,
  trackingMouse: false,
  statdata: null,
  n: 0,
  rendering: false,
};

// extra variables to show mesh plane intersections in 2D renderers
let sceneClip = new THREE.Scene();

function onScroll(event) {
  const id = event.target.domElement.id;
  let stackHelper = null;
  switch (id) {
    case 'r1':
      stackHelper = r1.stackHelper;
      break;
 /*   case 'r2':
      stackHelper = r2.stackHelper;
      break;*/
  }

  if (event.delta > 0) {
    if (stackHelper.index > stackHelper.orientationMaxIndex - 1) {
      return false;
    }
    stackHelper.index += 1;
  } else {
    if (stackHelper.index <= 0) {
      return false;
    }
    stackHelper.index -= 1;
  }

  updateSlice();
}

function update3dCanvas() {
  r2.camera.aspect = r2.domElement.clientWidth / r2.domElement.clientHeight;
  r2.camera.updateProjectionMatrix();

  r2.renderer.setSize( r2.domElement.clientWidth, r2.domElement.clientHeight );
  r2.rtTexture.setSize( r2.domElement.clientWidth, r2.domElement.clientHeight );
}

// event listeners
function windowResize2D(rendererObj) {
  rendererObj.stackHelper.slice.canvasWidth = rendererObj.domElement.clientWidth;
  rendererObj.stackHelper.slice.canvasHeight = rendererObj.domElement.clientHeight;

  let canvas = {
    width: rendererObj.domElement.clientWidth,
    height: rendererObj.domElement.clientHeight,
  };

  rendererObj.renderer.setSize(
    rendererObj.domElement.clientWidth,
    rendererObj.domElement.clientHeight
  );

  rendererObj.camera.canvas = canvas;
  rendererObj.camera.update();
  rendererObj.camera.fitBox(2, 1);
}

function onWindowResize() {
  var vis = document.getElementById("visualizer");
  var header = document.getElementById("header");
  var aistats = document.getElementById("aistats-container");

  if( document.body.clientWidth < 600)
    r1.domElement.style.height = (vis.clientHeight - header.clientHeight - aistats.clientHeight) + "px";
  else
    r1.domElement.style.height = (vis.clientHeight - header.clientHeight) + "px";

  windowResize2D(r1);
  render();
}

function onKeyDown(event){
  if( !event.isComposing && event.keyCode == 	40 ) { //down arrow key
    if (r1.stackHelper.index > r1.stackHelper.orientationMaxIndex - 1) {
      return false;
    }
    r1.stackHelper.index++;
    //r2.stackHelper.index++;
  }
  if( !event.isComposing && event.keyCode == 38 ) { //up arrow key
    if (r1.stackHelper.index <= 0) {
      return false;
    }
    r1.stackHelper.index--;
    //r2.stackHelper.index--;
  }
  updateSlice();
}

function initRenderer3D() {
  // renderer
  r2.domElement = document.getElementById(r2.domId);
  r2.renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  
  r2.renderer.autoClear = false;
  r2.renderer.localClippingEnabled = true;
  r2.renderer.setSize(
    r2.domElement.clientWidth,
    r2.domElement.clientHeight
  );
  
  r2.renderer.setClearColor(0x000000, 1);
  r2.renderer.domElement.id = r2.targetID;
  r2.domElement.appendChild(r2.renderer.domElement);

  // camera
  r2.camera = new THREE.PerspectiveCamera( 40,  r2.domElement.clientWidth /  r2.domElement.clientHeight, 0.01, 3000.0 );
  r2.camera.position.z = 2.0;

  // scene
  r2.rtTexture = new THREE.WebGLRenderTarget( r2.domElement.clientWidth, r2.domElement.clientHeight,
    { 	minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS:  THREE.ClampToEdgeWrapping,
      wrapT:  THREE.ClampToEdgeWrapping,
      format: THREE.RGBAFormat,//.RGBFormat,
      type: THREE.UnsignedByteType,//.FloatType,
      generateMipmaps: false} );  

  r2.boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  r2.boxGeometry.doubleSided = true;

  r2.sceneFirstPass = new THREE.Scene();
  r2.sceneSecondPass = new THREE.Scene();

  $.when(
    $.ajax({url:"/static/fragmentShaderFirstPass.js",dataType:"text"}),
    $.ajax({url:"/static/vertexShaderFirstPass.js",dataType:"text"}),
  )
  .then(function(fs,vs) {

    r2.materialFirstPass = new THREE.ShaderMaterial( {
      vertexShader: vs[0],
      fragmentShader: fs[0],
      side: THREE.BackSide
    } );

    
    r2.meshFirstPass = new THREE.Mesh( r2.boxGeometry, r2.materialFirstPass );
    r2.sceneFirstPass.add( r2.meshFirstPass );
 
  });
  
  $.when(
    $.ajax({url:"/static/fragmentShaderSecondPass.js",dataType:"text"}),
    $.ajax({url:"/static/vertexShaderSecondPass.js",dataType:"text"}),
  ).then((fs,vs)=>{

    r2.materialSecondPass = new THREE.ShaderMaterial( {
      vertexShader: vs[0],
      fragmentShader: fs[0],
      side: THREE.FrontSide,
      uniforms: {	tex:  { type: "t", value: r2.rtTexture.texture },
            cubeTex:  { type: "t", value: null },
            steps : {type: "1f" , value: 100 },
            alphaCorrection : {type: "1f" , value: 1.5 },
            tiles : {type: "1f" , value: 7.0 },
            spacex : {type: "1f" , value: 1.0 },
            spacey : {type: "1f" , value: 1.0 },
            spacez : {type: "1f" , value: 1.0 },
            slice : {type: "1f" , value: 0.0 }}
    });

    r2.meshSecondPass = new THREE.Mesh( r2.boxGeometry, r2.materialSecondPass );
    r2.sceneSecondPass.add( r2.meshSecondPass );
  });
}

function initRenderer2D() {
  // renderer
  r1.domElement = document.getElementById(r1.domId);
  r1.renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  r1.renderer.autoClear = false;
  r1.renderer.localClippingEnabled = true;
  r1.renderer.setSize(
    r1.domElement.clientWidth,
    r1.domElement.clientHeight
  );
  r1.renderer.setClearColor(0x121212, 1);
  r1.renderer.domElement.id = r1.targetID;
  r1.domElement.appendChild(r1.renderer.domElement);

  // camera
  r1.camera = new CamerasOrthographic(
    r1.domElement.clientWidth / -2,
    r1.domElement.clientWidth / 2,
    r1.domElement.clientHeight / 2,
    r1.domElement.clientHeight / -2,
    1,
    1000
  );

  // controls
  r1.controls = new ControlsOrthographic(r1.camera, r1.domElement);
  r1.controls.staticMoving = false;
  r1.controls.noPan = true;
  r1.controls.noRotate = true;
  r1.camera.controls = r1.controls;
  r1.controls.addEventListener('OnScroll', onScroll);

  // scene
  r1.scene = new THREE.Scene();

  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('keydown', onKeyDown, false);

  document.getElementById("toggle_overlay").addEventListener('change', (event) => {
    r1.showOverlay = event.target.checked;
    render();
  });

  document.getElementById("select_threshold").addEventListener('change', (event) => {
    let targetVal = document.getElementById("select_threshold").value;
    console.log("CCA: switching to " + targetVal);

    r1.overlay_material = OverlayMasks[targetVal];
    r1.overlay_plane.material.map = r1.overlay_material[r1.stackHelper.index];
    r1.overlay_plane.material.needsUpdate = true;
    updateStats();
    render();
  });

}

function initHelpersStack(stack) {
  r1.stackHelper = new HelpersStack(stack);
  r1.stackHelper.bbox.visible = false;
  r1.stackHelper.borderColor = r1.sliceColor;
  r1.stackHelper.slice.canvasWidth = r1.domElement.clientWidth;
  r1.stackHelper.slice.canvasHeight = r1.domElement.clientHeight;

  // set camera
  let worldbb = stack.worldBoundingBox();
  let lpsDims = new THREE.Vector3(
    (worldbb[1] - worldbb[0]) / 2,
    (worldbb[3] - worldbb[2]) / 2,
    (worldbb[5] - worldbb[4]) / 2
  );

  // box: {halfDimensions, center}
  let box = {
    center: stack.worldCenter().clone(),
    halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10),
  };

  // init and zoom
  let canvas = {
    width: r1.domElement.clientWidth,
    height: r1.domElement.clientHeight,
  };

  r1.camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
  r1.camera.box = box;
  r1.camera.canvas = canvas;
  r1.camera.orientation = r1.sliceOrientation;
  r1.camera.update();
  r1.camera.fitBox(2, 1);

  r1.stackHelper.slice.interpolation = 0;
  r1.stackHelper.orientation = r1.camera.stackOrientation;
  r1.stackHelper.index = Math.floor(r1.stackHelper.orientationMaxIndex / 2);
  r1.scene.add(r1.stackHelper);
}

let rendering  = false;

function render() {
  // we are ready when both meshes have been loaded
  if(rendering) return;
  rendering = true;

  if (ready) {
    // render
    r1.controls.update();
    r1.renderer.clear();
    r1.renderer.render(r1.scene, r1.camera);

    if( r1.showOverlay ) {
      r1.renderer.clearDepth();
      r1.renderer.render(r1.overlay_scene, r1.camera);
    }
  }

  //stats.update();
  rendering = false;
}

function animate3d() {
  if( r2.rendering ) {
    r2.n += 0.01;
    
    r2.camera.position.x = 1.5*Math.sin(r2.n);
    r2.camera.position.y = 1.5*Math.cos(r2.n);
    r2.camera.position.z = 0;

    r2.camera.lookAt(0,0,0);
    r2.camera.updateProjectionMatrix();

    render3d();

    setTimeout(() => {
      requestAnimationFrame( animate3d );
    }, 10);
  }
}

function render3d() {
  r2.renderer.setRenderTarget(r2.rtTexture);
  r2.renderer.clear();
  r2.renderer.render( r2.sceneFirstPass, r2.camera );

  r2.renderer.setRenderTarget(null);
  r2.renderer.clear();
  r2.renderer.render( r2.sceneSecondPass, r2.camera );
}


function animate() {
  render();
}


/**
 * Init the quadview
 */
function init() {
  initRenderer2D();
  initRenderer3D();
  animate();
}

function bindRangeSlice(){
  $('#range-slice').range({
    min: 1,
    max: r1.stackHelper.orientationMaxIndex+1,
    start: r1.stackHelper.orientationMaxIndex - r1.stackHelper.slice.index + 1,
    step: 1,
    onChange: function(value) {
      r1.stackHelper.index = r1.stackHelper.orientationMaxIndex - value + 1;
      updateSlice(true);
    }
  });
}

function viewClick(e,x){
  $("#btn-viewsingle").removeClass("active");
  $("#btn-viewmulti").removeClass("active");
  $("#btn-view3d").removeClass("active");

  $(e.handleObj.data).toggleClass("active");
}

$(document).ready(function(){

    $('#range-opacity').range({
      min: 0,
      max: 1,
      start: 0.5,
      step: 0.01,
      onChange: function(value) {
        if( r1.overlay_plane && r1.overlay_plane.material )
        {
          r1.overlay_plane.material.opacity = value;
          render();
        }
      }
    });

    $('#range-ww').range({
      min: 1,
      max: 1,
      start: 1,
      step: 1
    });

    $('#range-wl').range({
      min: 1,
      max: 1,
      start: 1,
      step: 1
    });

    $('#range-slice').range({
      min: 1,
      max: 1,
      start: 1,
      step: 1,
    });


  $('#visualizer').dimmer('show');
  $("#visualizer").unbind("click");

  $("#btn-view3d").click("#btn-view3d",viewClick);
  $("#btn-viewsingle").click("#btn-viewsingle",viewClick);
  $("#btn-viewmulti").click("#btn-viewmulti",viewClick);

  $('#visualizer').dimmer('hide');

  loadExmaple();

  $("#btn3d").click(function(){
    $("#3dRenderingContent").css("display", "block");
    $("#loadExampleContent").css("display", "none");
    $("#visualizer").dimmer("show");
    r2.rendering = true;
    animate3d();
    update3dCanvas();
  });

  $("#btnclose3d").click(function(){
    $("#visualizer").dimmer("hide");
    r2.rendering = false;
  });

  $("#btnLoad").click(function(){
    $("#3dRenderingContent").css("display", "none");
    $("#loadExampleContent").css("display", "block");
    $('#visualizer').dimmer('show');
    document.getElementById("loaderdiv").className = "ui active transition visible dimmer";
    $("#visualizer").unbind("click");
  })

  $("#r1").mousedown(function() {
    r1.trackingMouse = true;
  });
  $("#r1").mouseup(function() {
    r1.trackingMouse = false;
  });
  $("#r1").mousemove(function(event) {
    if( !r1.trackingMouse ) return false;

    var maxWidth = r1.domElement.clientWidth;
    var maxHeight = r1.domElement.clientHeight;

    var x = event.offsetX;
    var y = event.offsetY;

    var min = r1.stackHelper.stack.minMax[0];
    var max = r1.stackHelper.stack.minMax[1];
    var diff = max - min;

    var WW = x * diff / maxWidth + min;
    var WL = y * diff / maxHeight + min;

    WW = Math.round(WW * 100) / 100;
    WL = Math.round(WL * 100) / 100;

    $('#range-ww').range('set value', WW);
    $('#range-wl').range('set value', WL);

    updateSlice();
  });

});

// window.onload = function() {};

function updateSlice(fromRange) {
  if( !r1.stackHelper || !r1.stackHelper.slice ) return;
	const worldCenter = r1.stackHelper.stack.worldCenter();
  if(r1.overlay_plane) {
    r1.overlay_plane.position.set( worldCenter.x,worldCenter.y,r1.stackHelper.slice.mesh.position.z + r1.stackHelper.index * r1.stackHelper.slice.spacing );
	  r1.overlay_plane.material.map = r1.overlay_material[r1.stackHelper.index];
    r1.overlay_plane.material.needsUpdate = true;
  }

  var pos = r1.stackHelper.slice.mesh.position.z + r1.stackHelper.index * r1.stackHelper.slice.spacing;
  document.getElementById("r1-info-topleft").innerHTML = "Im: " + (r1.stackHelper.orientationMaxIndex - r1.stackHelper.slice.index + 1) + "/" + (r1.stackHelper.orientationMaxIndex + 1);
  document.getElementById("r1-info-bottomleft").innerHTML = "WL: " + r1.stackHelper.slice.windowCenter + " WW: " + r1.stackHelper.slice.windowWidth + "<br/>T: " + r1.stackHelper.stack._sliceThickness + "mm L:" + pos.toFixed(1) + "mm";
  //document.getElementById("r1-info-topright").innerHTML = r1.patiendID + "<br/>" + r1.patientsex + "<br/>" + r1.studyDescription;

  if(!fromRange) bindRangeSlice();
	render();
}

function updateStats(){
	if(r1.statdata && r1.stackHelper ){
		
		var thickness = r1.stackHelper.stack._sliceThickness;
		var voxelVolume = r1.stackHelper.stack._spacing.x * r1.stackHelper.stack._spacing.y * r1.stackHelper.stack._spacing.z;
		var lungPixels = 0;
		var group2Pixels= 0;
		var group3Pixels= 0;
		var group4Pixels= 0;
		
		$.each(r1.statdata.Value.stats, function(x) {
			lungPixels += r1.statdata.Value.stats[x].lungs;
			group2Pixels += r1.statdata.Value.stats[x].group2;
			group2Pixels += r1.statdata.Value.stats[x].group3;
			group2Pixels += r1.statdata.Value.stats[x].group4;
		});
		
    //1000000 mm^3 = Liter
    var totalLungPixels = (lungPixels+group2Pixels+group3Pixels+group4Pixels);
    var liters = totalLungPixels * voxelVolume / 1000000;
    var affectedLiters = (group2Pixels+group3Pixels+group4Pixels) * voxelVolume / 1000000;

    var affected = 100.0 * (group2Pixels+group3Pixels+group4Pixels) / totalLungPixels;
    var unaffected = 100.0 * lungPixels / totalLungPixels;
		var group2affected = 100.0 * (group2Pixels) / totalLungPixels;
		var group3affected = 100.0 * (group3Pixels) / totalLungPixels;
		var group4affected = 100.0 * (group4Pixels) / totalLungPixels;
    
    $("#lungLiters").text(liters.toFixed(2) + "L");
    $("#affectedLiters").text(affectedLiters.toFixed(2) + "L");
    $("#affectedPerc").text(affected.toFixed(2) + "%");
    $("#unaffectedPerc").text(unaffected.toFixed(2) + "%");
    $("#classification").text(r1.statdata.Value.classification);
		$("#GGstat").text(group2affected.toFixed(2) + "%");
		$("#GGOstat").text(group3affected.toFixed(2) + "%");
		$("#ConsolidationStat").text(group4affected.toFixed(2) + "%");
	}
}

function LoadMasks(files_mask, filter){
  let masks = [];
  if( filter == "")
    masks = files_mask.filter(x=>!x.includes("_cca_")).sort().reverse().map((file)=>{ return new THREE.TextureLoader().load( file ); });
  else
    masks = files_mask.filter(x=>x.includes(filter)).sort().reverse().map((file)=>{ return new THREE.TextureLoader().load( file ); });
  
  OverlayMasks[filter] = masks;
}

function loadExmaple() {
  
  $("#btn3d").addClass("disabled");
  // init threeJS
  if( r1.stackHelper ) {

    ready = false;

    r1.scene.children.forEach(x=>{ r1.scene.remove(x); x.remove();});
    r1.overlay_scene.children.forEach(x=>{ r1.overlay_scene.remove(x); x.remove();});
    r1.overlay_scene.dispose();
    r1.overlay_scene = null;

    r1.stackHelper.dispose();
    r1.stackHelper = null;

    r2.cubeTexture.dispose();
    r2.cubeTexture = null;
  }
  else {
    init();
  }

  // load sequence for each file
  // instantiate the loader
  // it loads and parses the dicom image
  let loader = new LoadersVolume();
  let files = exampleFiles.dicom;
  console.log(files);
  let files_mask = exampleFiles.mask;
  OverlayMasks.files_mask = files_mask;
  let tex3d = exampleFiles.tex3d;
  let statJson = exampleFiles.statJson;

  $.getJSON(statJson, function(json) {
    r1.statdata = json;
		updateStats();
	});


  THREE.DefaultLoadingManager.onLoad = function ( ) {
    r2.materialSecondPass.uniforms.cubeTex.value =  r2.cubeTexture;
    r2.camera.up.set( 0, 0, -1  );

    var tiles = Math.ceil(Math.sqrt(r1.stackHelper.orientationMaxIndex+1));
    var size = 512;
    var totalX = r1.stackHelper.stack._spacing.x * size;
    var totalY = r1.stackHelper.stack._spacing.y * size;
    var totalZ = r1.stackHelper.stack._spacing.z * (r1.stackHelper.orientationMaxIndex+1);
    var max = Math.max(Math.max(totalX,totalY),totalZ);

    r2.materialSecondPass.uniforms.tiles.value =  tiles;
    r2.materialSecondPass.uniforms.spacex.value = totalX / max;
    r2.materialSecondPass.uniforms.spacey.value = totalY / max;
    r2.materialSecondPass.uniforms.spacez.value = totalZ / max;

    console.log( 'Loading Complete!');

    setTimeout(function(){
		  updateSlice();
        document.getElementById("loaderdiv").className = "ui transition visible dimmer";
        $("#btn3d").removeClass("disabled");
    },50);
  };

  THREE.DefaultLoadingManager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
    console.log( 'Loaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
  };

  THREE.DefaultLoadingManager.onError = function ( url ) {
    console.log( 'There was an error loading ' + url );
  };

  // load sequence for all files
  loader
    .load(files)
    .then(function() {
      let series = loader.data[0].mergeSeries(loader.data)[0];

      r1.studyDescription = loader.data[0].studyDescription;
      r1.patiendID = loader.data[0]._patientID;
      r1.patientsex = loader.data[0].patientSex;


      loader.free();
      loader = null;
      // get first stack from series
      let stack = series.stack[0];
      stack.prepare();

      initHelpersStack(stack);
      
      var rescalseSlope = r1.stackHelper.slice._rescaleSlope;
      var rescaleIntercept = r1.stackHelper.slice._rescaleIntercept;
      var windowCenter = r1.stackHelper.slice._windowCenter;
      var windowWidth = r1.stackHelper.slice._windowWidth;
      var lowerThreshold = r1.stackHelper.slice._lowerThreshold;
      var upperThreshold = r1.stackHelper.slice._upperThreshold;

      r1.stackHelper.slice.intensityAuto = false;

      if(files_mask)
      {
        LoadMasks(files_mask, "");

        r1.overlay_material = OverlayMasks[""];

        // r1.overlay_material = files_mask.map((file)=>{ return new THREE.TextureLoader().load( file ); });
        // r1.overlay_material.reverse();

        var material = new THREE.SpriteMaterial( { map: r1.overlay_material[r1.stackHelper.index], color: 0xffffff } );
        material.opacity = 0.5;
        r1.overlay_plane = new THREE.Sprite( material );
        r1.overlay_plane.scale.set(stack._rows * stack._spacing.x , stack._columns * stack._spacing.y ,1);
        r1.overlay_scene = new THREE.Scene();
        r1.overlay_scene.add( r1.overlay_plane );

        const worldCenter = r1.stackHelper.stack.worldCenter();
        r1.overlay_plane.position.set( worldCenter.x,worldCenter.y,r1.stackHelper.slice.mesh.position.z + r1.stackHelper.index * r1.stackHelper.slice.spacing );
        r1.overlay_plane.material.map = r1.overlay_material[r1.stackHelper.index];
        r1.overlay_plane.material.needsUpdate = true;
      }

      new THREE.TextureLoader().load(tex3d, function ( texture ) { 	
        r2.cubeTexture = texture; 
        r2.cubeTexture.generateMipmaps = false;
        r2.cubeTexture.minFilter = THREE.LinearFilter;
        r2.cubeTexture.magFilter = THREE.LinearFilter;
      } );
        
      updateSlice();

      $('#range-ww').range({
        min: lowerThreshold,
        max: upperThreshold,
        start: r1.stackHelper.slice.windowWidth,
        step: 0.5,
        onChange: function(value){
          //r1.stackHelper.stack.windowWidth = value
          r1.stackHelper.slice.windowWidth = value;
          //r1.stackHelper.index = r1.stackHelper.index;
          updateSlice(true);
        }
      });

      $('#range-wl').range({
        min: lowerThreshold,
        max: upperThreshold,
        start: r1.stackHelper.slice.windowCenter,
        step: 0.5,
        onChange: function(value){
          r1.stackHelper.stack.windowCenter = value
          r1.stackHelper.slice.windowCenter = value;
          //r1.stackHelper.index = r1.stackHelper.index;
          updateSlice(true);
        }
      });

      onWindowResize();
      updateSlice();
	    updateStats();
      ready = true;
      render();
    })
    .catch(function(error) {
      window.console.log('oops... something went wrong...');
      window.console.log(error);
    });

};
