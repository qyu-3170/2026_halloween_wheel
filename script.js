/**
 * Trick or Spin! — 萬聖節校園命運轉盤
 * 核心邏輯腳本
 */

(function () {
  'use strict';

  // 1. 預設題庫資料 (16 個萬聖節校園任務選項)
  const DEFAULT_OPTIONS = [
    { id: "opt-1", text: "戴眼鏡的人" },
    { id: "opt-2", text: "穿深色衣服的人" },
    { id: "opt-3", text: "穿外套的人" },
    { id: "opt-4", text: "穿武陵褲的人" },
    { id: "opt-5", text: "坐著的人" },
    { id: "opt-6", text: "穿淺色衣服的人" },
    { id: "opt-7", text: "穿著有圖案衣服的人" },
    { id: "opt-8", text: "比你矮的人" },
    { id: "opt-9", text: "任意一位老師" },
    { id: "opt-10", text: "任意一個同學" },
    { id: "opt-11", text: "有當小老師或幹部的人" },
    { id: "opt-12", text: "你今天還沒說過話的人" },
    { id: "opt-13", text: "再抽一次！" },
    { id: "opt-14", text: "看起來很想吃糖果的人" },
    { id: "opt-15", text: "跟你座號+-5以內的人" },
    { id: "opt-16", text: "找一個人幫你轉轉盤" }
  ];

  // 萬聖節可愛色彩盤（循環套用於扇形格子）
  const PALETTE = [
    { bg: "#F59E0B", text: "#30203D" }, // 南瓜橘
    { bg: "#8B5CF6", text: "#FFF1D6" }, // 幽靈紫
    { bg: "#FFF1D6", text: "#30203D" }, // 奶油白
    { bg: "#EC4899", text: "#FFF1D6" }, // 糖果粉
    { bg: "#10B981", text: "#30203D" }, // 萬聖綠
    { bg: "#3B82F6", text: "#FFF1D6" }  // 奇幻藍
  ];

  // LocalStorage 保存鍵名
  const STORAGE_KEY_OPTIONS = "trick_or_spin_options_v1";
  const STORAGE_KEY_SOUND = "trick_or_spin_sound_enabled";

  // 2. 狀態管理
  let options = [];
  let isSpinning = false;
  let soundEnabled = true;
  let currentRotation = 0; // 累積總旋轉角度
  let audioCtx = null;
  let animationFrameId = null;

  // DOM 元素引用
  const wheelSvg = document.getElementById("wheel-svg");
  const spinBtn = document.getElementById("spin-btn");
  const soundToggleBtn = document.getElementById("sound-toggle-btn");
  const soundStatusText = document.getElementById("sound-status-text");
  const soundIcon = document.getElementById("sound-icon");
  const openEditorBtn = document.getElementById("open-editor-btn");

  // 結果彈窗
  const resultModal = document.getElementById("result-modal");
  const resultText = document.getElementById("result-text");
  const spinAgainBtn = document.getElementById("spin-again-btn");
  const closeResultBtn = document.getElementById("close-result-btn");

  // 編輯器彈窗
  const editorModal = document.getElementById("editor-modal");
  const closeEditorX = document.getElementById("close-editor-x");
  const cancelEditorBtn = document.getElementById("cancel-editor-btn");
  const saveEditorBtn = document.getElementById("save-editor-btn");
  const addOptionBtn = document.getElementById("add-option-btn");
  const resetDefaultBtn = document.getElementById("reset-default-btn");
  const optionsList = document.getElementById("options-list");
  const optionCountSpan = document.getElementById("option-count");
  const particlesContainer = document.getElementById("particles-container");

  // 3. 初始化程序
  function init() {
    loadSettings();
    renderWheel();
    setupEventListeners();
  }

  // 載入本地儲存
  function loadSettings() {
    // 載入音效設定
    const savedSound = localStorage.getItem(STORAGE_KEY_SOUND);
    if (savedSound !== null) {
      soundEnabled = JSON.parse(savedSound);
    }
    updateSoundUI();

    // 載入題庫設定
    try {
      const savedOptions = localStorage.getItem(STORAGE_KEY_OPTIONS);
      if (savedOptions) {
        const parsed = JSON.parse(savedOptions);
        if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 24) {
          options = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn("無法解析 localStorage 中的題庫，改用預設題庫。", e);
    }
    options = JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
  }

  // 儲存至 LocalStorage
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_OPTIONS, JSON.stringify(options));
      localStorage.setItem(STORAGE_KEY_SOUND, JSON.stringify(soundEnabled));
    } catch (e) {
      console.warn("無法寫入 localStorage。", e);
    }
  }

  // 4. Web Audio API 音效合成器
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  // 播放滴答旋轉聲
  function playTickSound(progress = 0) {
    if (!soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "triangle";
      // 核心細節：隨著減速進度 (progress 0 -> 1)，初始音調從 500Hz 微微降至 300Hz
      // 這會給聽覺帶來非常真實的「重力/摩擦力減速」暗示
      const currentFreq = 500 - (progress * 100);
      osc.frequency.setValueAtTime(currentFreq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.035);
      
      // 音量隨減速微微降低，避免最後一聲太刺耳
      const volume = 0.15 - (progress * 0.05);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      // 忽略音效異常
    }
  }

  // 播放中獎慶祝音效
  function playWinSound() {
    if (!soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        const startTime = audioCtx.currentTime + idx * 0.08;
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (e) {
      // 忽略音效異常
    }
  }

  function updateSoundUI() {
    soundStatusText.textContent = soundEnabled ? "音效：開啟" : "音效：關閉";
    soundIcon.textContent = soundEnabled ? "🔔" : "🔕";
  }

  // 5. SVG 轉盤繪製核心 logic
  function renderWheel() {
    wheelSvg.innerHTML = ""; // 清空

    const total = options.length;
    const sliceAngle = 360 / total;
    const cx = 300, cy = 300, r = 280;

    // 定義濾鏡與漸層
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
      </filter>
    `;
    wheelSvg.appendChild(defs);

    // 建立轉盤旋轉主群組
    const mainGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    mainGroup.setAttribute("id", "wheel-group");

    options.forEach((opt, index) => {
      const startAngle = index * sliceAngle;
      const endAngle = (index + 1) * sliceAngle;
      const colorScheme = PALETTE[index % PALETTE.length];

      // 計算弧形 Path Coordinates
      const x1 = cx + r * Math.cos((Math.PI * startAngle) / 180);
      const y1 = cy + r * Math.sin((Math.PI * startAngle) / 180);
      const x2 = cx + r * Math.cos((Math.PI * endAngle) / 180);
      const y2 = cy + r * Math.sin((Math.PI * endAngle) / 180);

      const largeArcFlag = sliceAngle > 180 ? 1 : 0;
      const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      // 扇形元素
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", colorScheme.bg);
      path.setAttribute("stroke", "#21152F");
      path.setAttribute("stroke-width", "2");
      mainGroup.appendChild(path);

      // 文字與排版群組
      const midAngle = startAngle + sliceAngle / 2;
      const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      
      // 將文字群組旋轉至扇形中央角度方向
      textGroup.setAttribute("transform", `rotate(${midAngle}, ${cx}, ${cy})`);

      const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textNode.setAttribute("x", cx + r * 0.65); // 擺放於半徑 65% 位置
      textNode.setAttribute("y", cy);
      textNode.setAttribute("fill", colorScheme.text);
      textNode.setAttribute("font-size", total > 18 ? "12" : total > 12 ? "14" : "16");
      textNode.setAttribute("font-weight", "bold");
      textNode.setAttribute("text-anchor", "middle");
      textNode.setAttribute("dominant-baseline", "central");
      textNode.setAttribute("filter", "url(#shadow)");

      // 處理長文字自動換行 (依字數分兩行)
      const text = opt.text;
      if (text.length > 7 && total <= 18) {
        const midPoint = Math.ceil(text.length / 2);
        const line1 = text.substring(0, midPoint);
        const line2 = text.substring(midPoint);

        const tspan1 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan1.setAttribute("x", cx + r * 0.65);
        tspan1.setAttribute("dy", "-0.6em");
        tspan1.textContent = line1;

        const tspan2 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan2.setAttribute("x", cx + r * 0.65);
        tspan2.setAttribute("dy", "1.2em");
        tspan2.textContent = line2;

        textNode.appendChild(tspan1);
        textNode.appendChild(tspan2);
      } else {
        textNode.textContent = text.length > 10 ? text.substring(0, 9) + "…" : text;
      }

      textGroup.appendChild(textNode);
      mainGroup.appendChild(textGroup);
    });

    // 繪製中心點裝飾蓋 (可愛幽靈)
    const centerCap = document.createElementNS("http://www.w3.org/2000/svg", "g");
    centerCap.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="45" fill="#21152F" stroke="#F59E0B" stroke-width="4" />
      <circle cx="${cx}" cy="${cy}" r="38" fill="#FFF1D6" />
      <!-- 可愛幽靈表情 -->
      <circle cx="${cx - 10}" cy="${cy - 5}" r="4" fill="#30203D" />
      <circle cx="${cx + 10}" cy="${cy - 5}" r="4" fill="#30203D" />
      <ellipse cx="${cx}" cy="${cy + 8}" rx="6" ry="8" fill="#30203D" />
      <circle cx="${cx - 14}" cy="${cy + 2}" r="3" fill="#EC4899" opacity="0.6" />
      <circle cx="${cx + 14}" cy="${cy + 2}" r="3" fill="#EC4899" opacity="0.6" />
    `;

    wheelSvg.appendChild(mainGroup);
    wheelSvg.appendChild(centerCap);

    // 恢復旋轉角度
    
    mainGroup.style.transformOrigin = "300px 300px";
    mainGroup.style.transform = `rotate(${currentRotation}deg)`;
  }

  // 6. 旋轉與隨機抽取邏輯
  function spin() {
    if (isSpinning || options.length === 0) return;

    initAudioContext();
    isSpinning = true;
    spinBtn.disabled = true;

    // 安全隨機算法：選出中獎索引 (0 ~ N-1)
    const total = options.length;
    const randomIndex = getRandomInt(0, total);
    const selectedOption = options[randomIndex];

    // 計算角度細節
    const sliceAngle = 360 / total;
    // 第 i 個選項的中心角度 (0° 在右側 3 點鐘方向)
    const sliceCenterAngle = randomIndex * sliceAngle + sliceAngle / 2;

    // 指針位於頂部 12 點鐘方向 (270°)
    // 計算欲停在指針下方時，轉盤需旋轉到的目標角度 (0 ~ 360)
    let targetDegreeInCircle = (270 - sliceCenterAngle) % 360;
    if (targetDegreeInCircle < 0) targetDegreeInCircle += 360;

    // 目前旋轉的角度模數 (0 ~ 360)
    const currentModulo = currentRotation % 360;

    // 計算從當前位置旋轉到目標位置所需的角度差
    let angleDiff = targetDegreeInCircle - currentModulo;
    if (angleDiff < 0) angleDiff += 360;

    // 多轉 5 ~ 8 圈以增加刺激感
    const extraSpins = (8 + getRandomInt(0, 5)) * 360;
    const totalSpinDegree = extraSpins + angleDiff;

    // 更新總累積角度
    currentRotation += totalSpinDegree;

    // 動畫時間 (4 ~ 5 秒)
    const duration = 6.5;
    // 確保旋轉時動態套用過場動畫
    const wheelGroup = document.getElementById("wheel-group");
    wheelGroup.style.transformOrigin = "300px 300px"; // 雙重保障中心點
    wheelGroup.style.transition = `transform ${duration}s cubic-bezier(0.05, 0.99, 0.05, 1)`;
    wheelGroup.style.transform = `rotate(${currentRotation}deg)`;

    // 設定 CSS Transition Easing (前快後減速)
    wheelGroup.style.transition = `transform ${duration}s cubic-bezier(0.15, 0.85, 0.15, 1)`;
    wheelGroup.style.transform = `rotate(${currentRotation}deg)`;

    // 監聽旋轉過場，實時觸發齒輪聲（精準指針對齊版）
    let lastSliceIndex = -1;
    let lastTickTime = 0;
    const minTickInterval = 22; // 防音效重疊卡頓最小間隔 (ms)
    const startTime = performance.now();

    function checkTick(now) {
      if (!isSpinning) return;
      const elapsed = (now - startTime) / 1000;

      if (elapsed < duration) {
        // 1. 正確解析 DOM Matrix 2D 旋轉角度 (0 ~ 360 順時針角度)
        const style = window.getComputedStyle(wheelGroup);
        const matrix = new DOMMatrix(style.transform);
        let rotationAngle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
        if (rotationAngle < 0) rotationAngle += 360;

        // 2. 精準計算「正上方 12 點鐘 (270度)」指針正下方的 SVG 弧度角度
        let pointerSvgAngle = (270 - rotationAngle) % 360;
        if (pointerSvgAngle < 0) pointerSvgAngle += 360;

        // 3. 計算指針當前正壓在哪一個扇形 (0 ~ total-1)
        const currentSliceIndex = Math.floor(pointerSvgAngle / sliceAngle);

        // 4. 只有在「指針剛好跨過分隔線 (扇形 Index 改變)」且非初始化第一張影格時發聲
        if (lastSliceIndex !== -1 && currentSliceIndex !== lastSliceIndex && (now - lastTickTime >= minTickInterval)) {
          const progress = Math.min(1, elapsed / duration);
          playTickSound(progress);
          lastTickTime = now;
        }

        lastSliceIndex = currentSliceIndex;
        animationFrameId = requestAnimationFrame(checkTick);
      }
    }

    animationFrameId = requestAnimationFrame(checkTick);

    // 旋轉結束處理
    setTimeout(() => {
      isSpinning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      playWinSound();
      showResult(selectedOption.text);
      triggerParticles();
      spinBtn.disabled = false;
    }, duration * 1000);
  }

  // 獲取真隨機整數 [min, max)
  function getRandomInt(min, max) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return min + (array[0] % (max - min));
  }

  // 7. 顯示結果卡片與特效
  function showResult(text) {
    resultText.textContent = text;
    resultModal.classList.remove("hidden");
  }

  function hideResult() {
    resultModal.classList.add("hidden");
  }

  // 生成萬聖節慶祝粒子特效
  function triggerParticles() {
    // 若使用者偏好減少動態效果，則不觸發粒子
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    particlesContainer.innerHTML = "";
    const symbols = ["🎃", "👻", "🍬", "⭐", "🦇", "✨", "🍭"];
    const count = 30;

    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "particle";
      el.textContent = symbols[getRandomInt(0, symbols.length)];
      
      // 從螢幕中央散開
      el.style.left = "50%";
      el.style.top = "50%";
      el.style.fontSize = `${getRandomInt(18, 36)}px`;

      const angle = Math.random() * Math.PI * 2;
      const distance = getRandomInt(120, 350);
      const dx = `${Math.cos(angle) * distance}px`;
      const dy = `${Math.sin(angle) * distance}px`;
      const rot = `${getRandomInt(-180, 180)}deg`;

      el.style.setProperty("--dx", dx);
      el.style.setProperty("--dy", dy);
      el.style.setProperty("--rot", rot);

      particlesContainer.appendChild(el);
    }

    // 動畫結束後自動移除粒子
    setTimeout(() => {
      particlesContainer.innerHTML = "";
    }, 1300);
  }

  // 8. 題庫編輯器 logic
  function openEditor() {
    if (isSpinning) return;
    renderEditorList();
    editorModal.classList.remove("hidden");
  }

  function closeEditor() {
    editorModal.classList.add("hidden");
  }

  function renderEditorList() {
    optionsList.innerHTML = "";
    optionCountSpan.textContent = options.length;

    options.forEach((opt, idx) => {
      const li = document.createElement("li");
      li.className = "option-item-row";

      const idxSpan = document.createElement("span");
      idxSpan.className = "option-index";
      idxSpan.textContent = `${idx + 1}.`;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "option-input";
      input.value = opt.text;
      input.maxLength = 20;
      input.placeholder = `選項 ${idx + 1}`;

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "delete-btn";
      delBtn.innerHTML = "&times;";
      delBtn.title = "刪除此項";
      delBtn.onclick = () => removeOptionRow(idx);

      li.appendChild(idxSpan);
      li.appendChild(input);
      li.appendChild(delBtn);
      optionsList.appendChild(li);
    });
  }

  function addOptionRow() {
    const currentInputs = optionsList.querySelectorAll(".option-input");
    if (currentInputs.length >= 24) {
      alert("轉盤選項最多不可超過 24 格！");
      return;
    }

    const tempOptions = getCurrentEditorValues();
    tempOptions.push({ id: `opt-${Date.now()}`, text: `新選項 ${tempOptions.length + 1}` });
    options = tempOptions;
    renderEditorList();

    // 自動聚焦最後一個輸入框
    const newInputs = optionsList.querySelectorAll(".option-input");
    if (newInputs.length > 0) {
      newInputs[newInputs.length - 1].focus();
    }
  }

  function removeOptionRow(index) {
    const tempOptions = getCurrentEditorValues();
    if (tempOptions.length <= 2) {
      alert("轉盤選項至少需要保留 2 格！");
      return;
    }
    tempOptions.splice(index, 1);
    options = tempOptions;
    renderEditorList();
  }

  function getCurrentEditorValues() {
    const inputs = optionsList.querySelectorAll(".option-input");
    const list = [];
    inputs.forEach((input, idx) => {
      const val = input.value.trim();
      list.push({
        id: options[idx]?.id || `opt-${Date.now()}-${idx}`,
        text: val || `選項 ${idx + 1}`
      });
    });
    return list;
  }

  function saveEditorChanges() {
    const updated = getCurrentEditorValues();
    
    // 檢查是否有完全空白無效的項目
    if (updated.some(item => !item.text.trim())) {
      alert("請確保所有選項皆非空白！");
      return;
    }

    if (updated.length < 2 || updated.length > 24) {
      alert("選項數量必須介於 2 到 24 之間。");
      return;
    }

    options = updated;
    saveSettings();
    renderWheel();
    closeEditor();
  }

  function resetDefaultOptions() {
    if (confirm("確定要恢復預設的 16 個萬聖節校園任務嗎？您自訂的內容將會被覆蓋。")) {
      options = JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
      saveSettings();
      renderEditorList();
      renderWheel();
    }
  }

  // 9. 事件監聽設定
  function setupEventListeners() {
    // 轉盤觸發
    spinBtn.addEventListener("click", spin);
    spinAgainBtn.addEventListener("click", () => {
      hideResult();
      spin();
    });
    closeResultBtn.addEventListener("click", hideResult);

    // 音效開關
    soundToggleBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      updateSoundUI();
      saveSettings();
    });

    // 編輯器按鈕
    openEditorBtn.addEventListener("click", openEditor);
    closeEditorX.addEventListener("click", closeEditor);
    cancelEditorBtn.addEventListener("click", closeEditor);
    saveEditorBtn.addEventListener("click", saveEditorChanges);
    addOptionBtn.addEventListener("click", addOptionRow);
    resetDefaultBtn.addEventListener("click", resetDefaultOptions);

    // 點擊彈窗外部背景關閉
    resultModal.addEventListener("click", (e) => {
      if (e.target === resultModal) hideResult();
    });
    editorModal.addEventListener("click", (e) => {
      if (e.target === editorModal) closeEditor();
    });

    // 鍵盤無障礙支援 (Esc 關閉彈窗, Space/Enter 旋轉)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideResult();
        closeEditor();
      }
    });
  }

  // 啟動應用程式
  document.addEventListener("DOMContentLoaded", init);

})();
