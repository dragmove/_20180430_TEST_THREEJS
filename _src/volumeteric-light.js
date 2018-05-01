import dat from 'dat.gui';
import Rx from 'rxjs/Rx';

(function($) {
  'use strict';

  const EffectComposer = require('three-effectcomposer')(THREE);

  /*
     * implement
     */
  $(document).ready(presetting);

  function presetting() {
    // https://medium.com/@andrew_b_berg/volumetric-light-scattering-in-three-js-6e1850680a41
    THREE.VolumetericLightShader = {
      uniforms: {
        tDiffuse: { value: null },
        lightPosition: { value: new THREE.Vector2(0.5, 0.5) },
        exposure: { value: 0.18 },
        decay: { value: 0.95 },
        density: { value: 0.8 },
        weight: { value: 0.4 },
        samples: { value: 50 }
      },

      vertexShader: ['varying vec2 vUv;', 'void main() {', 'vUv = uv;', 'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );', '}'].join('\n'),

      fragmentShader: [
        'varying vec2 vUv;',
        'uniform sampler2D tDiffuse;',
        'uniform vec2 lightPosition;',
        'uniform float exposure;',
        'uniform float decay;',
        'uniform float density;',
        'uniform float weight;',
        'uniform int samples;',
        'const int MAX_SAMPLES = 100;',
        'void main()',
        '{',
        'vec2 texCoord = vUv;',
        'vec2 deltaTextCoord = texCoord - lightPosition;',
        'deltaTextCoord *= 1.0 / float(samples) * density;',
        'vec4 color = texture2D(tDiffuse, texCoord);',
        'float illuminationDecay = 1.0;',
        'for(int i=0; i < MAX_SAMPLES; i++)',
        '{',
        'if(i == samples){',
        'break;',
        '}',
        'texCoord -= deltaTextCoord;',
        'vec4 sample = texture2D(tDiffuse, texCoord);',
        'sample *= illuminationDecay * weight;',
        'color += sample;',
        'illuminationDecay *= decay;',
        '}',
        'gl_FragColor = color * exposure;',
        '}'
      ].join('\n')
    };

    THREE.AdditiveBlendingShader = {
      uniforms: {
        tDiffuse: { value: null },
        tAdd: { value: null }
      },

      vertexShader: ['varying vec2 vUv;', 'void main() {', 'vUv = uv;', 'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );', '}'].join('\n'),

      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform sampler2D tAdd;',
        'varying vec2 vUv;',
        'void main() {',
        'vec4 color = texture2D( tDiffuse, vUv );',
        'vec4 add = texture2D( tAdd, vUv );',
        'gl_FragColor = color + add;',
        '}'
      ].join('\n')
    };

    THREE.PassThroughShader = {
      uniforms: {
        tDiffuse: { value: null }
      },

      vertexShader: ['varying vec2 vUv;', 'void main() {', 'vUv = uv;', 'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );', '}'].join('\n'),

      fragmentShader: ['uniform sampler2D tDiffuse;', 'varying vec2 vUv;', 'void main() {', 'gl_FragColor = texture2D( tDiffuse, vec2( vUv.x, vUv.y ) );', '}'].join('\n')
    };

    init();
  }

  function init() {
    var scene,
      camera,
      renderer,
      composer,
      box,
      pointLight,
      occlusionComposer,
      occlusionRenderTarget,
      occlusionBox,
      lightSphere,
      plane,
      volumetericLightShaderUniforms,
      DEFAULT_LAYER = 0,
      OCCLUSION_LAYER = 1,
      renderScale = 0.5,
      angle = 0,
      gui = new dat.GUI();

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);

    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    $('body').append(renderer.domElement);

    const resizeWindow$ = Rx.Observable.fromEvent(window, 'resize').startWith(null);
    resizeWindow$.subscribe(evt => {
      console.log('resize');

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);

      /*
            var pixelRatio = renderer.getPixelRatio(),
              newWidth = Math.floor(window.innerWidth / pixelRatio) || 1,
              newHeight = Math.floor(window.innerHeight / pixelRatio) || 1;
      
            composer.setSize(newWidth, newHeight);
            occlusionComposer.setSize(newWidth * renderScale, newHeight * renderScale);
            */
    });

    setupScene();
    setupPostprocessing();
    setupGUI();
    // addRenderTargetImage();
    onFrame();

    function setupScene() {
      let geometry, material;

      const imageWidth = 1920,
        imageHeight = 725,
        planeWidth = 1,
        planeHeight = 1;

      geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

      let texture = new THREE.TextureLoader().load('../img/1920x725.jpg'); // new THREE.TextureLoader().load('../img/1920_1080.png');
      material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

      plane = new THREE.Mesh(geometry, material);
      plane.scale.x = imageWidth;
      plane.scale.y = imageHeight;
      plane.position.set(0, 0, 0);
      scene.add(plane);

      pointLight = new THREE.PointLight(0xffffff);
      scene.add(pointLight);

      geometry = new THREE.SphereBufferGeometry(50, 16, 16);
      material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      lightSphere = new THREE.Mesh(geometry, material);
      lightSphere.layers.set(OCCLUSION_LAYER);
      scene.add(lightSphere);

      // show axes in the screen
      let axes = new THREE.AxesHelper(20);
      scene.add(axes);

      camera.position.z = 1000;
      camera.lookAt(scene.position);
    }

    function setupPostprocessing() {
      var pass;

      occlusionRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth * renderScale, window.innerHeight * renderScale);

      occlusionComposer = new EffectComposer(renderer, occlusionRenderTarget);
      occlusionComposer.addPass(new EffectComposer.RenderPass(scene, camera));

      pass = new EffectComposer.ShaderPass(THREE.VolumetericLightShader);
      pass.needsSwap = false;
      occlusionComposer.addPass(pass);

      volumetericLightShaderUniforms = pass.uniforms;

      composer = new EffectComposer(renderer);
      composer.addPass(new EffectComposer.RenderPass(scene, camera));

      pass = new EffectComposer.ShaderPass(THREE.AdditiveBlendingShader);
      pass.uniforms.tAdd.value = occlusionRenderTarget.texture;
      composer.addPass(pass);

      pass.renderToScreen = true;
    }

    function setupGUI() {
      var folder,
        min,
        max,
        step,
        updateShaderLight = function() {
          var p = lightSphere.position.clone(),
            vector = p.project(camera),
            x = (vector.x + 1) / 2,
            y = (vector.y + 1) / 2;

          volumetericLightShaderUniforms.lightPosition.value.set(x, y);
          pointLight.position.copy(lightSphere.position);
        };

      folder = gui.addFolder('LightSphere Position');
      folder
        .add(lightSphere.position, 'x')
        .min(-10)
        .max(10)
        .step(0.1)
        .onChange(updateShaderLight);
      folder
        .add(lightSphere.position, 'y')
        .min(-10)
        .max(10)
        .step(0.1)
        .onChange(updateShaderLight);
      folder
        .add(lightSphere.position, 'z')
        .min(-10)
        .max(10)
        .step(0.1)
        .onChange(updateShaderLight);

      folder.open();

      folder = gui.addFolder('Volumeteric Light Shader');
      Object.keys(volumetericLightShaderUniforms).forEach(function(key) {
        if (key !== 'tDiffuse' && key != 'lightPosition') {
          const prop = volumetericLightShaderUniforms[key];

          switch (key) {
            case 'exposure':
              min = 0;
              max = 1;
              step = 0.01;
              break;
            case 'decay':
              min = 0.8;
              max = 1;
              step = 0.001;
              break;
            case 'density':
              min = 0;
              max = 1;
              step = 0.01;
              break;
            case 'weight':
              min = 0;
              max = 1;
              step = 0.01;
              break;
            case 'samples':
              min = 1;
              max = 100;
              step = 1.0;
              break;
          }

          folder
            .add(prop, 'value')
            .min(min)
            .max(max)
            .step(step)
            .name(key);
        }
      });

      folder.open();

      folder = gui.addFolder('camera Position');
      folder
        .add(camera.position, 'x')
        .min(-100)
        .max(1000)
        .step(0.1)
        .onChange(updateShaderLight);
      folder
        .add(camera.position, 'y')
        .min(-100)
        .max(1000)
        .step(0.1)
        .onChange(updateShaderLight);
      folder
        .add(camera.position, 'z')
        .min(-100)
        .max(1000)
        .step(0.1)
        .onChange(updateShaderLight);

      folder.open();
    }

    function onFrame() {
      requestAnimationFrame(onFrame);

      update();
      render();
    }

    function render() {
      camera.layers.set(OCCLUSION_LAYER);
      renderer.setClearColor(0x000000);
      occlusionComposer.render();

      camera.layers.set(DEFAULT_LAYER);
      renderer.setClearColor(0x090611);
      composer.render();

      // renderer.setClearColor(0x000000, 0.5);
      // renderer.render(scene, camera);

      camera.lookAt(scene.position);
    }

    /*
        function addRenderTargetImage() {
          // todo: resolve error
          var material, mesh, folder;
    
          material = new THREE.ShaderMaterial(THREE.PassThroughShader);
          material.uniforms.tDiffuse.value = occlusionRenderTarget.texture;
    
          mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), material);
          composer.passes[1].scene.add(mesh);
          mesh.visible = false;
    
          folder = gui.addFolder('Light Pass Render Image');
          folder.add(mesh, 'visible');
          folder.add({ scale: 0.5 }, 'scale', { Full: 1, Half: 0.5, Quarter: 0.25 }).onChange(function(value) {
            renderScale = value;
            window.dispatchEvent(new Event('resize'));
          });
          folder.open();
        }
        */

    function update() {
      var radius = 0.05,
        xpos = Math.sin(angle) * radius,
        zpos = Math.cos(angle) * radius;

      lightSphere.position.set(xpos, 0, zpos);
      angle += 0.02;
      /*
            box.position.set(xpos, 0, zpos);
            box.rotation.x += 0.01;
            box.rotation.y += 0.01;
      
            occlusionBox.position.copy(box.position);
            occlusionBox.rotation.copy(box.rotation);
      
            angle += 0.02;
            */
    }
  }

  /*
    function setEvents() {
      const resizeWindow$ = Rx.Observable.fromEvent(window, 'resize').startWith(null);
      resizeWindow$.subscribe(resizeWindow);
  
      const mousemove$ = Rx.Observable.fromEvent(document, 'mousemove');
      mousemove$.subscribe(evt => {
        evt.preventDefault();
  
        const ratio = window.innerHeight / window.innerWidth;
  
        uniforms.u_mouse.value.x = (evt.pageX - window.innerWidth / 2) / (window.innerWidth / ratio);
        uniforms.u_mouse.value.y = (evt.pageY - window.innerHeight / 2) / (window.innerHeight * -1);
        uniforms.u_mousemoved.value = true;
      });
    }
  
    function resizeWindow(event) {
      renderer.setSize(window.innerWidth, window.innerHeight);
  
      uniforms.u_resolution.value.x = renderer.domElement.width;
      uniforms.u_resolution.value.y = renderer.domElement.height;
    }
    */
})(jQuery);
