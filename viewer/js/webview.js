var scroll_v = 1;
var zoom = 0;
var center = planes[0];
var is_dolly = 0;
var dolly = 1;
var pivoting = -1;
$( document ).ready(function() {
  document.getElementById("canvas-clip").remove();

  if (window.location.href.indexOf('http') == -1)
    window.location.href = (window.location.href.replace("file:///var/www/html", "http://localhost"));

  const canvas = document.querySelector('#glcanvas');
  canvas.width = w;
  canvas.height = h;

  const gl = canvas.getContext('webgl2');
  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  const scene = new Scene(gl, GETscene); 

  if (scene.nMpis == 1 && false) {
    var oImg = document.createElement("img");
    oImg.setAttribute('src', GETscene + '/mpi.png');
    oImg.setAttribute('width', '100%');
    document.body.appendChild(oImg);
    oImg = document.createElement("img");
    oImg.setAttribute('src', GETscene + '/mpi_alpha.png');
    oImg.setAttribute('width', '100%');
    document.body.appendChild(oImg);
  }

  var leftright = 0, updown = 0;
  var radius_total = 60, step_radius = 0, spiral_inout = 0;

  var tx = 0, ty = 0;
  var firstPlane = 0;
  var lastPlane = scene.nPlanes - 1;
  var spin_speed = 15, spin_radius = 30;
  var anim_time = 0;

  if (Array.isArray(planes[0])) {
    center = planes[0][0];
  }

  if (typeof rotationPlane != 'undefined') 
    center = rotationPlane;

  var rotation_factor = 0.3;

  var drag = false;
  var pitch = false;
  var old_x, old_y, old_pitch;
  var dX = 0, dY = 0;

  var mouseDown = function(e) {
    drag = true;
    if (e.touches == undefined){
      old_x = e.pageX, old_y = e.pageY;
    }
    else{
      if (e.touches.length === 2) {
        pitch = true;
        old_pitch = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
      }else{
        old_x = e.touches[0].pageX, old_y = e.touches[0].pageY;
      }
    }
    e.preventDefault();
    return false;
  };

  var mouseUp = function(e){
    drag = false;
    pitch = false;
  };

  var mouseMove = function(e) {
    if (!drag) return false;
    
    if(pitch){
      var dist =  Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      var delta = old_pitch - dist;
      zoom += delta * (planes[0][1] - planes[0][0])*0.25;
      scroll_v = zoom;
      old_pitch = dist;
    }else{
      if (e.touches == undefined) 
        mx = e.pageX, my = e.pageY;
      else
        mx = e.touches[0].pageX, my = e.touches[0].pageY;

      dX = (mx-old_x)*2*Math.PI/canvas.width,
      dY = (my-old_y)*2*Math.PI/canvas.height;

      old_x = mx, old_y = my;

      if (e.shiftKey) {
        tx += dX;
        ty -= dY;
      } else {
        leftright += dX * rotation_factor;
        updown += dY * rotation_factor;
      }
    }

    if (true) {
      if(typeof max_viewing_right !== 'undefined'){
        if (leftright > max_viewing_right) leftright = max_viewing_right;
      }
      if(typeof max_viewing_left !== 'undefined'){
        if (leftright < max_viewing_left) leftright = max_viewing_left;
      }
      if(typeof max_viewing_up !== 'undefined'){
        if (updown > max_viewing_up) updown = max_viewing_up;
      }
      if(typeof max_viewing_down !== 'undefined'){
        if (updown < max_viewing_down) updown = max_viewing_down;
      }
    }
    e.preventDefault();
  };

  var mousewheel = function(e) {
    var e = window.event || e; // old IE support
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    zoom += delta * (planes[0][1] - planes[0][0]) * 4;
    scroll_v = zoom;
  }

  canvas.addEventListener("mousedown", mouseDown, false);
  canvas.addEventListener("mouseup", mouseUp, false);
  canvas.addEventListener("mouseout", mouseUp, false);
  canvas.addEventListener("mousemove", mouseMove, false);
  canvas.addEventListener("mousewheel", mousewheel, false);

  canvas.addEventListener("touchstart", mouseDown, false);
  canvas.addEventListener("touchend", mouseUp, false);
  canvas.addEventListener("touchmove", mouseMove, false);


  var then = 0;
  var frameCount = 0;
  var d = new Date();
  var lastTime = new Date().getTime();
  var finishedLoading = 0;

  function render(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    if (spin_speed > 0) {
      anim_time += deltaTime * spin_speed * 0.1;

      if (movement_type == "motion_spiral" || movement_type == "motion_horizontal")
        //leftright = -0.08 -Math.sin(anim_time) * spin_radius / 500;
        leftright = -Math.sin(anim_time) * spin_radius / 500;
      if (movement_type == "motion_spiral" || movement_type == "motion_vertical")
        updown = Math.cos(anim_time) * spin_radius / 500;

      if (movement_type == "motion_spiral")
        spiral_inout = Math.sin(anim_time * 0.5) * spin_radius / 500;

      if (movement_type == "motion_mix") {
        spiral_inout = Math.sin(anim_time * 0.5) * spin_radius / 500;
      }

      step_radius += deltaTime * spin_speed;
    }
    //console.log(deltaTime);

    if (scene.ready) {
      var mv = mat4.create();
      if (movement_type == "motion_spiral_zoom") {
        dolly = 1;
        let theta = step_radius / radius_total * 2 * Math.PI;
        var zrate = 0.5;
        var radius_scale = spin_radius / 30;

        var radius = [[1.0, 1.0, 1.0]];
        if (typeof rads !== 'undefined') {
          radius[0] = rads[0];
        }
        var focus_plane = center;
        if (typeof focal !== 'undefined') {
          focus_plane = focal;
        }

        var cameraPosition = vec3.fromValues(
          Math.cos(theta) * radius[0][0] * radius_scale,
          -Math.sin(theta) * radius[0][1] * radius_scale, 
          -Math.sin(theta*zrate) * radius[0][2] * radius_scale);

        var target = vec3.fromValues(0, 0, -focus_plane);
        var up = vec3.fromValues(0, 1, 0)

        mat4.lookAt(mv, cameraPosition, target, up);

        if (typeof extrinsics !== 'undefined' && extrinsics[0].length == 16) {
          var ext2 = mat4.clone(extrinsics[0]);
          mat4.invert(ext2, ext2);
          ext2[1] *= -1;
          ext2[2] *= -1;
          ext2[4] *= -1;
          ext2[8] *= -1;
          ext2[13] *= -1;
          ext2[14] *= -1;
          mat4.multiply(mv, mv, ext2);
        }
      } else if (movement_type == 'motion_mix') {
        dolly = (center - zoom) / center;
        let theta = step_radius / (radius_total * 2) * 2 * Math.PI;
        let loopt = (theta - Math.floor(theta / (2 * Math.PI)) * 2 * Math.PI) / (2 * Math.PI);
        var radius_scale = spin_radius / 30;

        var radius = [[1.0, 1.0, 1.0]];
        if (typeof rads !== 'undefined') {
          radius[0] = rads[0];
        }
        var focus_plane = center;
        if (typeof focal !== 'undefined') {
          focus_plane = focal;
        }

        let xys = 1;
        //radius[0][0] = 0;
        //radius[0][1] = 0;
        zoom = (Math.sin(theta) - 1) * radius[0][2] * 1;
        //radius_scale *= 0.3 + (1 + Math.cos(theta)) / 3;
        radius_scale *= 0.5;
        var cameraPosition = vec3.fromValues(
          Math.cos(theta * xys) * radius[0][0] * radius_scale,
          -Math.sin(theta * xys) * radius[0][1] * radius_scale, 
          -zoom);

        var target = vec3.fromValues(0, 0, -focus_plane);
        var up = vec3.fromValues(0, 1, 0)

        mat4.lookAt(mv, cameraPosition, target, up);

        if (typeof extrinsics !== 'undefined' && extrinsics[0].length == 16) {
          var ext2 = mat4.clone(extrinsics[0]);
          mat4.invert(ext2, ext2);
          ext2[1] *= -1;
          ext2[2] *= -1;
          ext2[4] *= -1;
          ext2[8] *= -1;
          ext2[13] *= -1;
          ext2[14] *= -1;
          mat4.multiply(mv, mv, ext2);
        }
      } else {
        if (is_dolly) {
          dolly = (center - zoom) / center;
          mat4.translate(mv, mv, [tx, ty, -(center - zoom)]); 
        } else {
          dolly = 1;
          mat4.translate(mv, mv, [tx, ty, -(center + zoom)]); 
        }

        mat4.rotate(mv, mv, updown, [1, 0, 0]);      
        mat4.rotate(mv, mv, leftright, [0, 1, 0]); 
        mat4.translate(mv, mv, [0, 0.0, center]); 
      }
      scene.drawSceneNoVR(mv, deltaTime, firstPlane, lastPlane);
    }

    requestAnimationFrame(render);
    
    if (scene.ready) {
      if (finishedLoading == 0) {
        $("#fps").text("Initializing...");
        finishedLoading = 1;
      }
      frameCount ++;
      if (frameCount == 10) {
        var now = new Date().getTime(); 
        $("#fps").text("FPS: " + Math.round(10000 / (now - lastTime)));
        lastTime = now;
        frameCount = 0;
      }
    } else {
      $("#fps").text("Loading textures: " + scene.textureLoadedCount + " out of " + scene.textureTotalCount);
    }
  }
  requestAnimationFrame(render);


  if ($("#rotation_plane").length) {
    $("#rotation_plane").slider({
      range: false,
      min: 0,
      max: scene.nPlanes-1,
      values: [ 0 ],
      slide: function( event, ui ) {
        $("#center").html(ui.values[ 0 ]);
        if (scene.planes_is_2d)
          center = planes[0][ui.values[0]];
        else
          center = planes[ui.values[0]];
        pivoting = ui.values[0];
      },
      start: function(event, ui) {
        $("#rotation_plane_text").addClass("sliding_active");
      },
      stop: function(event, ui) {
        $("#rotation_plane_text").removeClass("sliding_active");
        pivoting = -1;
      }
    });
  }
  if ($("#show_plane").length) {
    $("#show_plane").slider({
      range: false,
      min: 0,
      max: scene.nPlanes-1,
      values: [ 0 ],
      slide: function( event, ui ) {
        $("#plane").html(ui.values[ 0 ]);
        $("#rendered_planes").slider("values", [ui.values[0], ui.values[0]]);
        firstPlane = ui.values[0];
        lastPlane = ui.values[0];
        $( "#amount" ).html(ui.values[ 0 ] + " - " + ui.values[ 0 ] );
      },
      start: function(event, ui) {
        $("#show_plane_text").addClass("sliding_active");
        $("#rendered_planes_text").addClass("sliding_active");
      },
      stop: function(event, ui) {
        $("#show_plane_text").removeClass("sliding_active");
        $("#rendered_planes_text").removeClass("sliding_active");
      }
    });
  }
  if ($("#rendered_planes").length) {
    $("#rendered_planes").slider({
      range: true,
      min: 0,
      max: scene.nPlanes-1,
      values: [ 0, scene.nPlanes-1 ],
      slide: function( event, ui ) {
        firstPlane = ui.values[0];
        lastPlane = ui.values[1];
        $( "#amount" ).html(ui.values[ 0 ] + " - " + ui.values[ 1 ] );
      },
      start: function(event, ui) {
        $("#rendered_planes_text").addClass("sliding_active");
      },
      stop: function(event, ui) {
        $("#rendered_planes_text").removeClass("sliding_active");
      }
    });
    $("#amount" ).html( "" + $( "#rendered_planes" ).slider( "values", 0 ) +
      " - " + $( "#rendered_planes" ).slider( "values", 1 ) );
  }
  if ($("#spin_radius").length) {
    $("#spin_radius").slider({
      range: false,
      min: 0,
      max: 100,
      values: [ 30 ],
      disabled: true,
      slide: function( event, ui ) {
        $("#radius").html(ui.values[ 0 ]);
        spin_radius = ui.values[0];
      },
      start: function(event, ui) {
        $("#spin_radius_text").addClass("sliding_active");
      },
      stop: function(event, ui) {
        $("#spin_radius_text").removeClass("sliding_active");
      }
    });
  }
  if ($("#spin_speed").length) {
    $("#spin_speed").slider({
      range: false,
      min: 0,
      max: 100,
      values: [ 15 ],
      disabled: true,
      slide: function( event, ui ) {
        $("#speed").html(ui.values[ 0 ]);
        spin_speed = ui.values[0];
      },
      start: function(event, ui) {
        $("#spin_speed_text").addClass("sliding_active");
      },
      stop: function(event, ui) {
        $("#spin_speed_text").removeClass("sliding_active");
      }
    });
  }

  //determine movement
  var movement_type = 'motion_none';
  $("#motion-selector").change(function(){
    movement_type = $('input[name="motion"]:checked').val();
    if (movement_type == "motion_none") {
      $("#spin_speed").slider("disable");
      $("#spin_radius").slider("disable");
      $("#spin_speed_text").addClass("sliding_disabled");
      $("#spin_radius_text").addClass("sliding_disabled");
    } else {
      $("#spin_speed").slider("enable");
      $("#spin_radius").slider("enable");
      $("#spin_speed_text").removeClass("sliding_disabled");
      $("#spin_radius_text").removeClass("sliding_disabled");
    }
  });
  $("#zoom-selector").change(function() {
    is_dolly = ($('input[name="zoom"]:checked').val() == "zoom_dolly");
  });
  
});
