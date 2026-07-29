
(function(){
  "use strict";
  var TARGET = './mirror/target.png';   
  var GRID   = 3;                        
  var FRAG   = './mirror/fragment.txt';  

  var board   = document.getElementById('board');
  var statusEl= document.getElementById('status');
  var winBox  = document.getElementById('win');
  var stage   = document.getElementById('stage');
  board.style.gridTemplateColumns = 'repeat(' + GRID + ',1fr)';

  var cells = [], state = [], srcCanvas = null, tile = 0, suppress = false;
  function msg(t){ statusEl.textContent = t; }

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
        c.addEventListener('click', function(){ if (suppress) return; state[idx].r = (state[idx].r + 90) % 360; render(); check(); });
      })(i);
    }
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
    stage.style.display = 'none'; winBox.classList.add('show');
    var wc = winBox.querySelector('canvas'), S = srcCanvas.width;
    wc.width = S; wc.height = S; wc.getContext('2d').drawImage(srcCanvas, 0, 0);
    msg('');
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
  img.onerror = function(){ board.innerHTML = '<div class="err">не удалось загрузить '+TARGET+'<br>положи целевую картинку (QR) по этому пути и обнови страницу.</div>'; };
  img.src = TARGET;

  var dl = winBox.querySelector('.dl'); if (dl) dl.setAttribute('href', FRAG);
})();
