/* ============================================================
   desktop.js — window manager, dock, ctx-menu, boot, вьюеры
   по типам файлов, image-nav, lock, final. Данные — из fs.js.
   Всё отображаемое кликабельно: папки, файлы, вложения,
   записи архива, навигация по картинкам.
   ============================================================ */
(function(){
  "use strict";
  var FS = window.FS;
  var $ = function(s,r){return (r||document).querySelector(s);};
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  var zTop = 20, wins = {}, created = 0, unlocked = false, IMG_CTX = null;

  /* иконки-ярлыки на рабочем столе и в доке */
  var ICONS = [
    {key:'welcome',  glyph:'▤', label:'welcome.txt'},
    {key:'inbox',    glyph:'✉', label:'inbox'},
    {key:'research', glyph:'◧', label:'sm-research'},
    {key:'hr',       glyph:'◨', label:'sm-hr'},
    {key:'locked',   glyph:'⛁', label:'sm-restricted', locked:true},
    {key:'terminal', glyph:'⌘', label:'terminal'}
  ];
  var DOCK = [
    {key:'inbox',    glyph:'✉', name:'inbox'},
    {key:'research', glyph:'◧', name:'sm-research'},
    {key:'hr',       glyph:'◨', name:'sm-hr'},
    {key:'locked',   glyph:'⛁', name:'sm-restricted', locked:true},
    {key:'terminal', glyph:'⌘', name:'terminal'},
    {key:'trash',    glyph:'␡', name:'trash'}
  ];

  /* приложения (не файлы) */
  var APPS = {
    about:{ title:'ОБ ЭТОЙ УТЕЧКЕ', render:function(){
      return '<div class="term">'+
        '<div class="ln">узел: internal-leak.node</div>'+
        '<div class="ln">статус зеркала: НЕ ПРОВЕРЕНО</div>'+
        '<div class="ln">сессия: анонимная / без входа</div>'+
        '<div class="ln dim"># это взломанный рабочий стол, оформленный источником</div>'+
        '<div class="ln dim"># под свой хакерский терминал. сами файлы — оригинальные.</div>'+
        '<div class="ln">подсказка: правый клик по обоям → ещё двери.</div></div>'; }},
    terminal:{ title:'TERMINAL — итоговый флаг', render:termHTML }
  };

  /* ---------- рендер узла ---------- */
  function renderNode(key, siblings){
    var n = FS[key];
    if(!n) return {title:'?', html:'<div class="term"><div class="ln dim">узел не найден</div></div>'};
    if(n.kind==='folder') return { title:n.name.toUpperCase()+' — '+n.items.length+' записей', html:renderFolder(key,n) };
    return { title:n.name, html:renderFile(key,n,siblings) };
  }

  function fic(ext){ // иконка типа файла
    if(ext==='folder') return '<div class="fic folder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>';
    return '<div class="fic"><span class="ext '+esc(ext)+'">'+esc(ext).toUpperCase()+'</span></div>';
  }

  function renderFolder(key, n){
    var h = '<div class="fpath">~/leak/<b>'+esc(n.name)+'</b> $ ls -la</div><div class="fgrid">';
    n.items.forEach(function(k){
      var c = FS[k]; if(!c) return;
      var ext = c.kind==='folder' ? 'folder' : (c.ext||'txt');
      h += '<div class="fitem" onclick="openNode(\''+k+'\',window.__SIB_'+key+')">'+
           fic(ext)+'<div class="fname">'+esc(c.name)+'</div></div>';
    });
    h += '</div>';
    window['__SIB_'+key] = n.items; // siblings для image-nav
    if(n.locked && !unlocked){
      return '<div class="fpath">~/leak/<b>'+esc(n.name)+'</b> $ access required</div>'+
        '<div class="lockbox"><div class="pr">&gt; введите код доступа, собранный из следов:</div>'+
        '<input type="text" id="lockInput" placeholder="ВВЕДИ КОД ДОСТУПА" autocomplete="off">'+
        '<button class="btn" onclick="tryUnlock()">ОТКРЫТЬ</button>'+
        '<div class="err" id="lockErr"></div></div>';
    }
    return h;
  }

  function renderFile(key, n, siblings){
    switch(n.type){
      case 'txt': {
        var rec = n.recovered ? '<span class="rec">восстановлено из удалённых</span><br>' : '';
        return frame(n.name, '<div class="paper"><div class="notepad'+(n.sys?' sys':'')+'">'+rec+esc(n.text)+'</div></div>');
      }
      case 'eml': {
        var att = '';
        if(n.attachments && n.attachments.length){
          att = '<div class="att"><div class="lab">вложения ('+n.attachments.length+')</div>';
          n.attachments.forEach(function(a){
            att += '<span class="chip" onclick="openNode(\''+a.key+'\')"><span class="d"></span>'+esc(a.name)+'</span>';
          });
          att += '</div>';
        }
        var xm = n.xmailer ? '<div class="xmail">'+esc(n.xmailer)+'</div>' : '';
        return frame(n.name,
          '<div class="paper"><div class="mail">'+
          '<div class="mh"><b>От:</b> '+esc(n.from)+'</div>'+
          '<div class="mh"><b>Кому:</b> '+esc(n.to)+'</div>'+
          '<div class="mh"><b>Дата:</b> '+esc(n.date)+'</div>'+
          '<div class="subj">'+esc(n.subject)+'</div>'+xm+
          '<hr><div class="mbody">'+esc(n.body)+'</div>'+att+
          '</div></div>');
      }
      case 'doc': {
        var p = n.paragraphs.map(function(x){return '<p>'+esc(x)+'</p>';}).join('');
        var ver = '';
        if(n.versions){ ver = '<div class="ver"><b>история версий:</b><br>'+
          n.versions.map(function(v){return '<span class="v">'+esc(v.v)+'</span> · '+esc(v.date)+' — '+esc(v.note);}).join('<br>')+'</div>'; }
        return frame(n.name,
          '<div class="paper"><div class="doc">'+(n.stamp?'<div class="stamp">'+esc(n.stamp)+'</div>':'')+
          '<h2>'+esc(n.title)+'</h2>'+p+ver+'</div></div>');
      }
      case 'pdf': {
        var s = n.sections.map(function(x){return '<h3>'+esc(x.h)+'</h3><p>'+esc(x.body)+'</p>';}).join('');
        return frame(n.name,
          '<div class="paper"><div class="pdf">'+(n.stamp?'<div class="stamp">'+esc(n.stamp)+'</div>':'')+
          '<h2>'+esc(n.title)+'</h2>'+s+'</div></div>');
      }
      case 'csv': {
        var th = n.headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('');
        var tr = n.rows.map(function(r){return '<tr>'+r.map(function(c){
          return '<td class="'+(String(c).toUpperCase()==='YES'?'yes':'')+'">'+esc(c)+'</td>';}).join('')+'</tr>';}).join('');
        return frame(n.name, '<div class="paper"><div class="csvwrap"><table class="csv"><thead><tr>'+th+'</tr></thead><tbody>'+tr+'</tbody></table></div></div>');
      }
      case 'zip': {
        var h = '<div class="zip"><div class="zh">~/leak/'+esc(n.name)+' $ unzip -l</div>';
        n.entries.forEach(function(e){
          var btn = e.key ? '<button onclick="openNode(\''+e.key+'\')">извлечь</button>'
                          : '<button disabled>зашифровано</button>';
          h += '<div class="zrow"><span class="zn">'+esc(e.name)+'</span><span class="zs">'+esc(e.size)+'</span>'+btn+'</div>';
        });
        return h+'</div>';
      }
      case 'image': {
        var list = siblings || [key];
        IMG_CTX = { list:list, idx:list.indexOf(key) };
        var stage = n.src
          ? '<img src="'+esc(n.src)+'" alt="'+esc(n.name)+'">'
          : '<div class="ph"><span class="ic">▣</span>превью не кешируется зеркалом<br>оригинал сохранён — смотри метаданные / QR / пиксели</div>';
        var nav = list.length>1
          ? '<button onclick="navImage(-1)">[ &lt; ]</button><span class="mid">'+(IMG_CTX.idx+1)+' / '+list.length+'</span><button onclick="navImage(1)">[ &gt; ]</button>'
          : '<span></span><span class="mid">'+esc(n.name)+'</span><span></span>';
        return '<div class="imgv"><div class="stage">'+stage+'</div>'+
          '<div class="cap">'+esc(n.caption)+'</div>'+
          '<div class="note">'+esc(n.note)+'</div>'+
          '<div class="nav">'+nav+'</div></div>';
      }
    }
    return '<div class="term"><div class="ln dim">неизвестный тип</div></div>';
  }
  function frame(name, inner){
    return '<div class="frame"><div class="fr-bar">~/leak/<b>'+esc(name)+'</b> — просмотр</div>'+inner+'</div>';
  }

  function termHTML(){
    return '<div class="term">'+
      '<div class="ln dim">source@leak:~$ cat /etc/motd</div>'+
      '<div class="ln">бэкдор активен. финальный флаг собирается только здесь.</div>'+
      '<div class="ln dim">source@leak:~$ введите итоговый флаг (склейка фрагментов от бота):</div>'+
      '<div class="inrow"><span>&gt;</span><input type="text" id="finalInput" placeholder="offzone{...}" autocomplete="off">'+
      '<button class="btn" onclick="tryFinal()">ВВОД</button></div>'+
      '<div class="ok" id="finalMsg"></div>'+
      '<div class="story" id="finalStory" style="display:none">'+
      '[ здесь после решения раскрывается полный текст — почему закрылся SilentSafeMind '+
      'и как произошла утечка. placeholder финальной лоры. ]</div></div>';
  }

  /* ---------- window manager ---------- */
  function ensureWin(key){
    if(wins[key]) return wins[key];
    var w = document.createElement('div');
    w.className = 'win'; w.id = 'win-'+key;
    var n = created++;
    w.style.top  = (70 + (n*26)%170) + 'px';
    w.style.left = (120 + (n*34)%320) + 'px';
    w.style.width = '520px';
    w.innerHTML =
      '<div class="win-head"><span class="t"></span>'+
      '<span class="ctrls"><span data-act="min">[ _ ]</span><span data-act="max">[ + ]</span><span data-act="close">[ x ]</span></span></div>'+
      '<div class="win-body"></div>';
    $('#desktop').appendChild(w);
    wins[key] = w;
    // focus on mousedown
    w.addEventListener('mousedown', function(){ focus(w); });
    // controls
    w.querySelector('.ctrls').addEventListener('click', function(e){
      var a = e.target.getAttribute('data-act'); if(!a) return;
      if(a==='close') closeWin(key);
      else if(a==='min') minWin(key);
      else if(a==='max') w.classList.toggle('max');
    });
    // drag
    var head = w.querySelector('.win-head'), dragging=false, ox=0, oy=0;
    head.addEventListener('mousedown', function(e){
      if(e.target.closest('.ctrls')) return;
      if(w.classList.contains('max')) return;
      dragging=true; ox=e.clientX-w.offsetLeft; oy=e.clientY-w.offsetTop;
    });
    document.addEventListener('mousemove', function(e){ if(!dragging) return;
      w.style.left=(e.clientX-ox)+'px'; w.style.top=Math.max(30,e.clientY-oy)+'px'; });
    document.addEventListener('mouseup', function(){ dragging=false; });
    return w;
  }
  function focus(w){ w.style.zIndex = ++zTop; }

  window.openNode = function(key, siblings){
    var node = FS[key] || APPS[key];
    if(!node) return;
    var w = ensureWin(key);
    var r = APPS[key] ? {title:APPS[key].title, html:APPS[key].render()} : renderNode(key, siblings);
    w.querySelector('.win-head .t').textContent = r.title;
    w.querySelector('.win-body').innerHTML = r.html;
    w.classList.add('open'); w.classList.remove('min');
    focus(w);
    w.classList.remove('glitch-in'); void w.offsetWidth; w.classList.add('glitch-in');
    updateDock();
  };
  function closeWin(key){ var w=wins[key]; if(!w) return; w.classList.remove('open','min','max'); updateDock(); }
  function minWin(key){ var w=wins[key]; if(!w) return; w.classList.add('min'); updateDock(); }
  window.closeWin=closeWin; window.minWin=minWin;

  window.navImage = function(dir){
    if(!IMG_CTX) return;
    var i = IMG_CTX.idx + dir;
    if(i<0||i>=IMG_CTX.list.length) return;
    openNode(IMG_CTX.list[i], IMG_CTX.list);
  };

  window.tryUnlock = function(){
    var v = ($('#lockInput')||{}).value || '';
    if(v.trim().toUpperCase() === 'ANNA-0417'){
      unlocked = true; openNode('locked'); // перерисует как разблокированную папку
    } else {
      var e = $('#lockErr'); if(e) e.textContent = 'ДОСТУП ЗАПРЕЩЁН — код неверен';
    }
  };
  window.tryFinal = function(){
    var v = ($('#finalInput')||{}).value || '';
    var m = $('#finalMsg');
    if(v.trim() === 'offzone{welcome_come_together}'){
      m.style.color=''; m.textContent = 'ДОСТУП РАЗРЕШЁН — расшифровка архива…';
      var s = $('#finalStory'); if(s) s.style.display='block';
    } else { m.style.color='var(--red)'; m.textContent='не совпадает'; }
  };

  /* ---------- dock ---------- */
  function buildDock(){
    var d = $('#dock');
    DOCK.forEach(function(it){
      var el = document.createElement('div');
      el.className = 'dock-ic'+(it.locked?' locked':'');
      el.setAttribute('data-node', it.key);
      el.setAttribute('data-name', it.name);
      el.innerHTML = it.glyph+'<span class="run"></span>';
      el.addEventListener('click', function(){ dockClick(it.key); });
      d.appendChild(el);
    });
  }
  function dockClick(key){
    var w = wins[key];
    var open = w && w.classList.contains('open');
    var min  = w && w.classList.contains('min');
    var top  = w && parseInt(w.style.zIndex||0,10) === zTop;
    if(open && !min && top){ minWin(key); } else { openNode(key); }
  }
  function updateDock(){
    document.querySelectorAll('.dock-ic[data-node]').forEach(function(d){
      var w = wins[d.getAttribute('data-node')];
      var open = w && w.classList.contains('open');
      d.classList.toggle('running', !!open);
      d.classList.toggle('active', !!open && !w.classList.contains('min'));
    });
  }

  /* ---------- desktop shortcuts ---------- */
  function buildIcons(){
    var c = $('#icons');
    ICONS.forEach(function(it){
      var el = document.createElement('div');
      el.className = 'icon'+(it.locked?' locked':'');
      el.innerHTML = '<div class="glyph">'+it.glyph+'</div><div class="label">'+esc(it.label)+'</div>';
      el.addEventListener('click', function(){ selectIcon(el); openNode(it.key); });
      c.appendChild(el);
    });
  }
  function selectIcon(el){
    document.querySelectorAll('.icon.sel').forEach(function(i){i.classList.remove('sel');});
    el.classList.add('sel');
  }
  $('#desktop').addEventListener('mousedown', function(e){
    if(!e.target.closest('.icon')) document.querySelectorAll('.icon.sel').forEach(function(i){i.classList.remove('sel');});
  });

  /* ---------- context menu ---------- */
  var ctx = $('#ctx');
  function hideCtx(){ ctx.style.display='none'; }
  $('#desktop').addEventListener('contextmenu', function(e){
    if(e.target.closest('.win,#dock,.icon,#topbar,#ctx,#boot')) return;
    e.preventDefault(); ctx.style.display='block';
    ctx.style.left = Math.min(e.clientX, window.innerWidth-220)+'px';
    ctx.style.top  = Math.min(e.clientY, window.innerHeight-170)+'px';
  });
  document.addEventListener('click', hideCtx);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') hideCtx(); });
  window.__ctx = {
    refresh:function(){ hideCtx(); var g=$('#grid'); g.style.transition='opacity .2s'; g.style.opacity='0'; setTimeout(function(){g.style.opacity='.7';},180); },
    arrange:function(){ hideCtx(); document.querySelectorAll('#icons .icon').forEach(function(ic){ ic.style.transition='transform .2s'; ic.style.transform='translateX(6px)'; setTimeout(function(){ic.style.transform='';},200); }); }
  };

  /* ---------- clock + watermark ---------- */
  function tick(){ var d=new Date(); $('#clock').textContent = d.toTimeString().slice(0,8); }
  tick(); setInterval(tick,1000);
  (function(){ var wm=$('#wm'); for(var i=0;i<60;i++){ var s=document.createElement('span'); s.textContent='SILENT MIND // INTERNAL —'; wm.appendChild(s); } })();

  /* ---------- boot sequence ---------- */
  var BOOT = [
    ['> инициализация зеркала internal-leak.node',''],
    ['> монтирование слитой файловой системы ... ','ok'],
    ['> расшифровка welcome.txt ... ','ok'],
    ['> восстановление удалённых записей ... ','ok'],
    ['> проверка целостности ... ','warn: 2 файла повреждены'],
    ['> сессия: анонимная / не авторизована',''],
    ['> добро пожаловать. не верь интерфейсу.','']
  ];
  function runBoot(){
    var b = $('#boot'), box = $('#boot .lines');
    var i = 0;
    function step(){
      if(i>=BOOT.length){ finish(); return; }
      var ln = document.createElement('div'); ln.className='bline';
      ln.innerHTML = esc(BOOT[i][0]) + (BOOT[i][1]?'<span class="'+(BOOT[i][1]==='ok'?'ok':'w')+'">'+esc(BOOT[i][1])+'</span>':'');
      box.appendChild(ln); i++;
      setTimeout(step, 220);
    }
    function finish(){ setTimeout(function(){ b.classList.add('done'); setTimeout(function(){ b.style.display='none'; openNode('welcome'); }, 480); }, 350); }
    function skip(){ b.classList.add('done'); setTimeout(function(){ b.style.display='none'; openNode('welcome'); }, 300); }
    step();
    b.addEventListener('click', skip, {once:true});
    document.addEventListener('keydown', function h(e){ if(e.key==='Enter'||e.key===' '){ document.removeEventListener('keydown',h); skip(); } }, {once:true});
    // автопропуск-страховка
    setTimeout(function(){ if(b.style.display!=='none') skip(); }, 6000);
  }

  /* ---------- init ---------- */
  buildIcons(); buildDock();
  runBoot();
})();
