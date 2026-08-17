(function(){
  "use strict";

  // ---------------------------------------------------------------
  // Sprite data (base64 PNGs, cleaned & cropped from the uploaded sheet)
  // ---------------------------------------------------------------
  const SPR = {
    clock: "images/clock.png",
    rhino: "images/rhino.png",
    mammoth: "images/mammoth.png",
    squirrel: "images/squirrel.png",
    snake: "images/snake.png",
    mouse: "images/mouse.png",
    monkey: "images/monkey.png",
    dog: "images/dog.png",
    cat: "images/cat.png",
    koala: "images/koala.png",
    penguin: "images/penguin.png",
    elephant_teal: "images/elephant_teal.png",
    elephant_purple: "images/elephant_purple.png",
    elephant_blue: "images/elephant_blue.png",
  };

  // "facing" = which way the animal's head points in its original artwork.
  // This determines whether we need to mirror it (scaleX) before rotating,
  // so that its FEET always end up pressed against the clock, head leading
  // the direction of travel (up on the left side, down on the right side).
  // "big" = heavyweight animal (elephants + mammoth): drawn larger, and
  // squashes the clock flat instead of triggering a normal strike.
  const ANIMALS = [
    { id:'mouse',           name:'Mouse',           src:SPR.mouse,           aspect: 1.7347,           facing:'right', big:false },
    { id:'squirrel',        name:'Squirrel',        src:SPR.squirrel,        aspect: 1.6114,        facing:'left',  big:false },
    { id:'dog',             name:'Dog',             src:SPR.dog,             aspect: 1.4783,             facing:'left',  big:false },
    { id:'monkey',          name:'Monkey',          src:SPR.monkey,          aspect: 1.0759,          facing:'left',  big:false },
    { id:'snake',           name:'Snake',           src:SPR.snake,           aspect: 1.6667,           facing:'left',  big:false },
    { id:'rhino',           name:'Rhino',           src:SPR.rhino,           aspect: 1.3178,           facing:'left',  big:false },
    { id:'cat',             name:'Cat',             src:SPR.cat,             aspect: 0.7206,             facing:'right', big:false },
    { id:'koala',           name:'Koala',           src:SPR.koala,           aspect: 0.9059,           facing:'right', big:false },
    { id:'penguin',         name:'Penguin',         src:SPR.penguin,         aspect: 1.0059,         facing:'right', big:false },
    { id:'mammoth',         name:'Mammoth',         src:SPR.mammoth,         aspect: 0.7542,         facing:'right', big:true  },
    { id:'elephant_teal',   name:'Baby Elephant',   src:SPR.elephant_teal,   aspect: 1.4201,   facing:'left',  big:true  },
    { id:'elephant_purple', name:'Purple Elephant', src:SPR.elephant_purple, aspect: 1.0105, facing:'left',  big:true  },
    { id:'elephant_blue',   name:'Elephant',        src:SPR.elephant_blue,   aspect: 1.1034,   facing:'left',  big:true  },
  ];
  const BIG_COUNT = ANIMALS.filter(a=>a.big).length;
  const NORMAL_COUNT = ANIMALS.length - BIG_COUNT;

  // Rotation needed so the animal is vertical, feet toward the clock:
  //  - left zone (climbing up):   rotate -90deg (+ mirror if it naturally faces left)
  //  - right zone (climbing down): rotate +90deg (+ mirror if it naturally faces left)
  function climbTransform(zone, facing){
    if (zone === 'left')  return 'rotate(-90deg)' + (facing === 'left' ? ' scaleX(-1)' : '');
    if (zone === 'right') return 'rotate(90deg)'  + (facing === 'left' ? ' scaleX(-1)' : '');
    return 'none';
  }

  const NUMBER_WORDS = ['one','two','three','four','five','six','seven','eight','nine','ten'];

  const stage = document.getElementById('stage');
  const tray = document.getElementById('tray');
  const clockImg = document.getElementById('clockImg');
  const clockZone = document.querySelector('.clock-zone');
  const crackOverlay = document.getElementById('crackOverlay');
  const dizzyStars = document.getElementById('dizzyStars');
  const fixBtn = document.getElementById('fixBtn');
  const rhymeText = document.getElementById('rhymeText');
  const rhymeBanner = document.getElementById('rhymeBanner');
  const verseTag = document.getElementById('verseTag');

  clockImg.src = SPR.clock;

  let verseCount = 0;
  let broken = false;
  const activeInstances = {};   // animalId -> wrap element (currently on stage, undelivered)
  const doneSet = new Set();

  // ---------------------------------------------------------------
  // Build tray buttons
  // ---------------------------------------------------------------
  ANIMALS.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'tray-btn';
    btn.id = 'traybtn-' + a.id;
    btn.title = a.name;
    btn.innerHTML = `<img src="${a.src}" alt="${a.name}"><span class="ribbon">✓</span>`;
    btn.addEventListener('click', () => onTrayClick(a));
    tray.appendChild(btn);
  });

  function onTrayClick(animal){
    if (broken) {
      flashHint(fixBtn, "Fix the clock first!");
      return;
    }
    if (activeInstances[animal.id]) {
      // already out - give it a little wiggle so the child can find it
      const el = activeInstances[animal.id];
      el.animate([
        { transform: el.dataset.baseTransform || 'translate(0,0)' },
        { transform: 'translate(6px,0)' },
        { transform: 'translate(-6px,0)' },
        { transform: 'translate(0,0)' }
      ], { duration: 300 });
      return;
    }
    spawnAnimal(animal);
  }

  function flashHint(nearEl, msg){
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = msg;
    const r = nearEl.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    hint.style.left = (r.left - sr.left + r.width/2 - 60) + 'px';
    hint.style.top = (r.top - sr.top - 34) + 'px';
    stage.appendChild(hint);
    requestAnimationFrame(()=> hint.classList.add('show'));
    setTimeout(()=>{
      hint.classList.remove('show');
      setTimeout(()=> hint.remove(), 300);
    }, 1200);
  }

  // ---------------------------------------------------------------
  // Spawning + dragging
  // ---------------------------------------------------------------
  function spawnAnimal(animal){
    const wrap = document.createElement('div');
    wrap.className = 'animal-wrap';
    wrap.dataset.animalId = animal.id;

    const img = document.createElement('img');
    img.src = animal.src;
    wrap.appendChild(img);

    const width = animal.big ? 210 : 130;
    wrap.style.width = width + 'px';

    const sr = stage.getBoundingClientRect();
    const trayRect = tray.getBoundingClientRect();
    const startLeft = (trayRect.right - sr.left) + 24;
    const startTop = sr.height * 0.62;
    wrap.style.left = startLeft + 'px';
    wrap.style.top = startTop + 'px';

    stage.appendChild(wrap);
    activeInstances[animal.id] = wrap;

    document.getElementById('traybtn-' + animal.id).classList.add('active-out');

    makeDraggable(wrap, animal);
  }

  function makeDraggable(wrap, animal){
    let dragging = false;
    let offX = 0, offY = 0;
    let delivered = false;

    wrap.addEventListener('pointerdown', (e) => {
      if (delivered) return;
      dragging = true;
      wrap.classList.add('dragging');
      wrap.classList.remove('landed');
      wrap.setPointerCapture(e.pointerId);
      const r = wrap.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!dragging || delivered) return;
      const sr = stage.getBoundingClientRect();
      let x = e.clientX - sr.left - offX;
      let y = e.clientY - sr.top - offY;
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      x = Math.max(-w*0.3, Math.min(sr.width - w*0.7, x));
      y = Math.max(-h*0.2, Math.min(sr.height - h*0.5, y));
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';

      updateOrientation(wrap, animal);

      if (!broken){
        const zone = getClockZone(wrap);
        if (zone === 'success'){
          finishDrag();
          handleReachTop(wrap, animal);
          delivered = true;
        }
      }
    });

    function finishDrag(){
      dragging = false;
      wrap.classList.remove('dragging');
      wrap.classList.add('landed');
    }

    wrap.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      finishDrag();
      updateOrientation(wrap, animal);
    });
    wrap.addEventListener('pointercancel', finishDrag);
  }

  // ---------------------------------------------------------------
  // Zone detection relative to the clock
  // ---------------------------------------------------------------
  function getClockZone(wrap){
    const cr = clockImg.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const cx = wr.left + wr.width/2;
    const cy = wr.top + wr.height*0.5;

    const touchingX = cx > cr.left - cr.width*0.12 && cx < cr.right + cr.width*0.12;
    const touchingY = cy > cr.top - cr.height*0.12 && cy < cr.bottom + cr.height*0.02;
    if (!touchingX || !touchingY) return 'none';

    const leftBound = cr.left + cr.width*0.34;
    const rightBound = cr.left + cr.width*0.66;
    const topSuccessMaxY = cr.top + cr.height*0.26;

    if (cx >= leftBound && cx <= rightBound && cy <= topSuccessMaxY){
      return 'success';
    }
    if (cx < leftBound) return 'left';
    if (cx > rightBound) return 'right';
    return 'top';
  }

  function updateOrientation(wrap, animal){
    const img = wrap.querySelector('img');
    if (broken){ img.style.transform = 'none'; return; }
    const zone = getClockZone(wrap);
    img.style.transform = climbTransform(zone, animal.facing);
  }

  // ---------------------------------------------------------------
  // Success / break handling
  // ---------------------------------------------------------------
  function handleReachTop(wrap, animal){
    const img = wrap.querySelector('img');
    img.style.transform = 'none';

    // snap neatly on top of the clock
    const cr = clockZone.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const targetLeft = (cr.left - sr.left) + cr.width*0.5 - wrap.offsetWidth*0.5;
    const targetTop = (cr.top - sr.top) - wrap.offsetHeight*0.62;
    wrap.style.left = targetLeft + 'px';
    wrap.style.top = targetTop + 'px';

    if (animal.big){
      setTimeout(()=> breakClock(wrap, animal), 420);
    } else {
      setTimeout(()=> strikeSuccess(wrap, animal), 420);
    }
  }

  function spawnSparkles(centerEl){
    const sr = stage.getBoundingClientRect();
    const r = centerEl.getBoundingClientRect();
    const cx = r.left - sr.left + r.width/2;
    const cy = r.top - sr.top + r.height*0.3;
    const glyphs = ['✨','⭐','🌟'];
    for (let i=0;i<10;i++){
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.textContent = glyphs[i % glyphs.length];
      const angle = (Math.PI*2/10)*i;
      const dist = 70 + Math.random()*40;
      s.style.setProperty('--dx', Math.cos(angle)*dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle)*dist + 'px');
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      stage.appendChild(s);
      setTimeout(()=> s.remove(), 750);
    }
  }

  function strikeSuccess(wrap, animal){
    verseCount++;
    doneSet.add(animal.id);
    const traybtn = document.getElementById('traybtn-' + animal.id);
    traybtn.classList.remove('active-out');
    traybtn.classList.add('done');

    clockImg.classList.remove('tick');
    void clockImg.offsetWidth;
    clockImg.classList.add('struck-bounce');
    clockImg.classList.add('tick');

    spawnSparkles(wrap);

    const n = NUMBER_WORDS[Math.min(verseCount-1, NUMBER_WORDS.length-1)];
    rhymeText.textContent = `Hickory dickory dock, the ${animal.name.toLowerCase()} ran up the clock! The clock struck ${n}, the ${animal.name.toLowerCase()} ran down. Hickory dickory dock!`;
    verseTag.textContent = n.charAt(0).toUpperCase()+n.slice(1);
    rhymeBanner.classList.remove('pulse');
    void rhymeBanner.offsetWidth;
    rhymeBanner.classList.add('pulse');

    // animal runs back down the other side, then vanishes with a little poof
    setTimeout(()=>{
      const img = wrap.querySelector('img');
      img.style.transform = climbTransform('right', animal.facing);
      const sr = stage.getBoundingClientRect();
      const curLeft = parseFloat(wrap.style.left);
      wrap.classList.add('landed');
      wrap.style.left = (curLeft + 90) + 'px';
      wrap.style.top = (sr.height*0.62) + 'px';
    }, 550);

    setTimeout(()=>{
      wrap.classList.add('poof');
    }, 1150);

    setTimeout(()=>{
      wrap.remove();
      delete activeInstances[animal.id];
      if (doneSet.size >= NORMAL_COUNT){ // all regular-sized animals done
        maybeGrandFinale();
      }
    }, 1650);
  }

  function maybeGrandFinale(){
    rhymeText.textContent = `Only the big ones are left... elephants and the mammoth are heavy! Hickory dickory dock!`;
  }

  function breakClock(wrap, animal){
    broken = true;
    clockImg.classList.remove('tick','struck-bounce');
    void clockImg.offsetWidth;
    clockImg.classList.add('broken');
    crackOverlay.classList.add('show');
    dizzyStars.classList.add('show');
    fixBtn.classList.add('show');

    rhymeText.textContent = `Uh oh! Hickory dickory CRASH — the ${animal.name.toLowerCase()} squashed the clock flat! Tap "Fix the Clock" to set things right.`;
    verseTag.textContent = '!!';
    rhymeBanner.classList.remove('pulse');
    void rhymeBanner.offsetWidth;
    rhymeBanner.classList.add('pulse');

    // it sits proudly atop the flattened clock for a moment, then hops off
    const img = wrap.querySelector('img');
    img.style.transform = 'none';
    setTimeout(()=>{
      wrap.classList.add('poof');
    }, 900);
    setTimeout(()=>{
      wrap.remove();
      delete activeInstances[animal.id];
    }, 1350);

    // disable every tray button while broken
    ANIMALS.forEach(a=>{
      document.getElementById('traybtn-'+a.id).disabled = true;
    });
  }

  fixBtn.addEventListener('click', () => {
    broken = false;
    clockImg.classList.remove('broken');
    clockImg.classList.add('tick');
    crackOverlay.classList.remove('show');
    dizzyStars.classList.remove('show');
    fixBtn.classList.remove('show');

    ANIMALS.forEach(a=>{
      const btn = document.getElementById('traybtn-'+a.id);
      btn.disabled = false;
      btn.classList.remove('active-out');
    });

    rhymeText.textContent = `All fixed! Hickory dickory dock, the clock is ticking again — pick another animal!`;
    verseTag.textContent = '♪';
  });

})();
