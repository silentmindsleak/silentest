(function(){
  "use strict";
  var TARGET = './mirror/target.png';
  var GRID   = 3;
  var FRAG   = './mirror/fragment.txt';

  var board    = document.getElementById('board');
  var statusEl = document.getElementById('status');
  var winBox   = document.getElementById('win');
  var stage    = document.getElementById('stage');
  if(!board) return;
  board.style.gridTemplateColumns = 'repeat(' + GRID + ',1fr)';

  var cells = [], state = [], srcCanvas = null, tile = 0, suppress = false;
  function msg(t){ if(statusEl) statusEl.textContent = t; }

  // --- помехи при переходе (туда-обратно) ---
  var fx = document.getElementById('fx');
  window.goTransition = function(e, url, text){
    if(e) e.preventDefault();
    if(!fx){ window.location.href = url; return; }
    fx.classList.remove('in');
    fx.classList.add('go');
    var txt = fx.querySelector('.txt');
    if(txt && text) txt.textContent = text;
    setTimeout(function(){ window.location.href = url; }, 860);
  };

  // входные помехи при загрузке страницы
  window.addEventListener('DOMContentLoaded', function(){
    document.body.classList.add('entering');
    if(fx){
      fx.classList.add('in');
      setTimeout(function(){
        fx.classList.remove('in');
        document.body.classList.remove('entering');
      }, 900);
    }
  });

  function buildCells(){
    board.innerHTML = ''; cells = [];
    for (var i = 0; i < GRID*GRID; i++){
      var c = document.createElement('div'); c.className = 'cell'; c.draggable = true; c.dataset.i = i;
      var cv = document.createElement('canvas'); c.appendChild(cv);
      board.appendChild(c); cells.push({ el:c, cv:cv });
      (function(idx){
        c.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed='move'; c.classList.add('drag'); });
        c.addEventListener('dragend',   function(){ c.classList.remove('drag'); });
        c.addEventListener('dragover',  function(e){ e.preventDefault(); c.classList.add('over'); });
        c.addEventListener('dragleave', function(){ c.classList.remove('over'); });
        c.addEventListener('drop',      function(e){ e.preventDefault(); c.classList.remove('over');
          var from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (isNaN(from)) return;
          if (from !== idx){ var tmp = state[from]; state[from] = state[idx]; state[idx] = tmp; render(); check(); }
          suppress = true; setTimeout(function(){ suppress = false; }, 0);
        });
        c.addEventListener('click', function(){ if (suppress) return; state[idx].r = (state[idx].r + 90) % 360; render(); check(); bumpCell(c); });
        c.addEventListener('touchstart', function(){},{passive:true});
      })(i);
    }
  }

  function bumpCell(el){
    el.style.transform = 'scale(0.92) rotate(1deg)';
    setTimeout(function(){ el.style.transform=''; }, 120);
  }

  function drawCell(i){
    var cv = cells[i].cv, s = state[i], ctx = cv.getContext('2d'), sz = tile;
    cv.width = sz; cv.height = sz; ctx.clearRect(0,0,sz,sz);
    ctx.save(); ctx.translate(sz/2, sz/2); ctx.rotate(s.r * Math.PI/180);
    var sx = (s.t % GRID) * tile, sy = Math.floor(s.t / GRID) * tile;
    ctx.drawImage(srcCanvas, sx, sy, tile, tile, -tile/2, -tile/2, tile, tile);
    ctx.restore();
  }
  function render(){ for (var i = 0; i < state.length; i++) drawCell(i); }
  function check(){ for (var i = 0; i < state.length; i++){ if (state[i].t !== i || state[i].r !== 0) return; } win(); }

  function win(){
    if(stage) stage.style.display = 'none';
    winBox.classList.add('show');
    var wc = winBox.querySelector('canvas'), S = srcCanvas.width;
    wc.width = S; wc.height = S; wc.getContext('2d').drawImage(srcCanvas, 0, 0);
    msg('отражение восстановлено. синхронизация...');
    launchFireworks();
  }

  // --- УЛУЧШЕННЫЙ ФЕЙЕРВЕРК ---
  function launchFireworks(){
    // overlay canvas
    var c = document.createElement('canvas');
    c.id = 'fireworks';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000;background:transparent;';
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    function resize(){ c.width = window.innerWidth; c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);

    var rockets = [];
    var particles = [];
    var startTime = performance.now();
    var duration = 9000; // 9 секунд шоу
    var lastRocket = 0;

    function rand(min,max){ return Math.random()*(max-min)+min; }

    function spawnRocket(){
      var x = rand(c.width*0.2, c.width*0.8);
      rockets.push({
        x:x, y:c.height+10,
        vx:rand(-1.2,1.2),
        vy:rand(-11,-14),
        hue: rand(0,60)>30 ? rand(175,210) : rand(330,350), // cyan / magenta
        life:0,
        targetY: rand(c.height*0.15, c.height*0.45)
      });
    }

    function explode(rx, ry, hue){
      var count = 90 + Math.floor(Math.random()*60);
      for(var i=0;i<count;i++){
        var ang = Math.random()*Math.PI*2;
        var spd = rand(2, 10);
        particles.push({
          x:rx, y:ry,
          vx:Math.cos(ang)*spd + rand(-1,1),
          vy:Math.sin(ang)*spd,
          life: rand(50,110),
          maxLife: 110,
          hue: hue + rand(-18,18),
          size: rand(1.5,3.8),
          gravity: 0.12 + Math.random()*0.08,
          friction: 0.98,
          twinkle: Math.random()>0.6
        });
      }
      // central flash
      particles.push({
        x:rx, y:ry,
        vx:0, vy:0,
        life: 12, maxLife:12,
        hue:hue,
        size: 22,
        flash:true
      });
      // ring particles
      for(var j=0;j<18;j++){
        var a2 = (j/18)*Math.PI*2;
        particles.push({
          x:rx, y:ry,
          vx:Math.cos(a2)*5.5,
          vy:Math.sin(a2)*5.5,
          life: 36,
          maxLife:36,
          hue:hue,
          size:2.2,
          gravity:0.02
        });
      }
    }

    function loop(now){
      var dt = now - startTime;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(0,0,c.width,c.height);
      ctx.globalCompositeOperation = 'lighter';

      // spawn rockets periodically until 6 sec
      if(now - lastRocket > 220 && dt < 6200){
        spawnRocket();
        lastRocket = now;
        if(Math.random()>0.6) setTimeout(spawnRocket, 120);
      }

      // rockets
      for(var i=rockets.length-1;i>=0;i--){
        var r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.18;
        r.life++;
        // trail
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI*2);
        ctx.fillStyle = 'hsla('+r.hue+',100%,68%,0.9)';
        ctx.fill();
        // explode condition
        if(r.vy > -1 || r.y <= r.targetY){
          explode(r.x, r.y, r.hue);
          rockets.splice(i,1);
        }
      }

      // particles
      for(var p=particles.length-1;p>=0;p--){
        var pa = particles[p];
        if(pa.flash){
          ctx.beginPath();
          ctx.arc(pa.x, pa.y, pa.size*(pa.life/12)*1.8, 0, Math.PI*2);
          ctx.fillStyle = 'hsla('+pa.hue+',100%,85%,'+(pa.life/12)+')';
          ctx.fill();
        }else{
          pa.x += pa.vx;
          pa.y += pa.vy;
          pa.vx *= (pa.friction||0.99);
          pa.vy += (pa.gravity||0.12);
          pa.life--;
          var alpha = Math.max(0, pa.life/pa.maxLife);
          if(pa.twinkle && Math.floor(pa.life/3)%2===0) continue; // мерцание
          ctx.beginPath();
          ctx.arc(pa.x, pa.y, pa.size*alpha, 0, Math.PI*2);
          if(pa.size>2) {
            ctx.fillStyle = 'hsla('+pa.hue+',100%,'+(65+alpha*10)+'%,'+alpha+')';
            ctx.shadowColor = 'hsl('+pa.hue+',100%,60%)';
            ctx.shadowBlur = 10;
          } else {
            ctx.fillStyle = 'hsla('+pa.hue+',90%,70%,'+alpha+')';
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        if(pa.life<=0) particles.splice(p,1);
      }

      ctx.globalCompositeOperation = 'source-over';

      // финальный текст сияние
      if(dt>400 && dt<8500){
        ctx.fillStyle = 'rgba(243,242,238,'+(0.02+Math.sin(dt*0.01)*0.015)+')';
        ctx.fillRect(0,0,c.width,c.height);
      }

      if(dt < duration || particles.length>0 || rockets.length>0){
        requestAnimationFrame(loop);
      }else{
        // затухание
        var fade = 0;
        function fadeOut(){
          fade+=0.05;
          ctx.fillStyle = 'rgba(0,0,0,'+fade*0.2+')';
          ctx.fillRect(0,0,c.width,c.height);
          if(fade<1) requestAnimationFrame(fadeOut); else c.remove();
        }
        fadeOut();
        // оставляем win состояние
      }
    }
    requestAnimationFrame(loop);

    // также дрожь страницы и звукоподобный эффект бордера
    document.body.style.animation = 'none';
    var s = document.createElement('style');
    s.textContent = '@keyframes screenShake{0%,100%{transform:translate(0,0)}10%{transform:translate(-2px,1px)}20%{transform:translate(2px,-1px)}30%{transform:translate(-1px,2px)}40%{transform:translate(1px,-2px)}50%{transform:translate(-2px,-1px)}60%{transform:translate(2px,1px)}70%{transform:translate(-1px,-1px)}80%{transform:translate(1px,2px)}} body.shaking{animation:screenShake 160ms linear 6}';
    document.head.appendChild(s);
    document.body.classList.add('shaking');
    setTimeout(function(){ document.body.classList.remove('shaking'); }, 1000);
  }

  function shuffle(){
    var n = GRID*GRID, arr = [], i, j, t;
    for (i = 0; i < n; i++) arr.push(i);
    do { for (i = n-1; i > 0; i--){ j = Math.floor(Math.random()*(i+1)); t = arr[i]; arr[i] = arr[j]; arr[j] = t; } }
    while (arr.every(function(v,k){ return v === k; }));
    state = [];
    for (var k = 0; k < n; k++) state.push({ t: arr[k], r: [0,90,180,270][Math.floor(Math.random()*4)] });
    if (state.every(function(s,k){ return s.t === k && s.r === 0; })) state[0].r = 90;
  }

  function start(img){
    var w = img.naturalWidth, h = img.naturalHeight;
    var T = Math.floor(Math.min(w, h) / GRID), S = T * GRID;
    srcCanvas = document.createElement('canvas'); srcCanvas.width = S; srcCanvas.height = S;
    var ox = Math.floor((w - S)/2), oy = Math.floor((h - S)/2);
    srcCanvas.getContext('2d').drawImage(img, ox, oy, S, S, 0, 0, S, S);
    tile = T; buildCells(); shuffle(); render();
    msg('перетаскивай фрагменты мышью · клик по фрагменту — поворот по часовой стрелке');
  }

  var img = new Image();
  img.onload  = function(){ start(img); };
  img.onerror = function(){ board.innerHTML = '<div class="err">не удалось загрузить '+TARGET+'<br>положи целевую картинку (QR) по этому пути и обнови страницу. Путь: mirror/target.png</div>'; };
  img.src = TARGET;

  var dl = winBox.querySelector('.dl'); if (dl) dl.setAttribute('href', FRAG);
})();
