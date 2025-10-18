// 複数ストップウォッチ管理
let stopwatches = [];
let nextStopwatchId = 1;
let currentRunningStopwatchId = null; // 現在動作中のストップウォッチID

// カテゴリ管理
let categories = [];
let nextCategoryId = 1;

// Slack Webhook URL を保存する変数
let slackWebhookUrl = null;
let slackUsername = ''; // Slackに通知する際のユーザ名
let slackWebhookEnabled = false; // タイマー操作のSlack通知の有効/無効
let slackTaskCompleteEnabled = false; // タスク完了のSlack通知の有効/無効
let apiKey = ''; // AI APIキー
let alwaysOnTop = true; // 常に最前面に表示

// 設定ダイアログから開いたかどうかのフラグ
let openedFromSettings = false;

// 保存先と自動保存設定
let saveLocation = ''; // 保存先パス
let autoSaveEnabled = false; // 自動保存の有効/無効
let autoSaveTimer = null; // 自動保存タイマー

const { ipcRenderer } = require('electron');

// 通知の許可をリクエスト
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Slack Webhook URLを読み込む
function loadSlackWebhookUrl() {
  const savedUrl = localStorage.getItem('slackWebhookUrl');
  if (savedUrl) {
    slackWebhookUrl = savedUrl;
    console.log('Slack Webhook URLを読み込みました:', slackWebhookUrl);
  }
  
  const savedUsername = localStorage.getItem('slackUsername');
  if (savedUsername) {
    slackUsername = savedUsername;
    console.log('Slackユーザ名を読み込みました:', slackUsername);
  }
  
  const savedEnabled = localStorage.getItem('slackWebhookEnabled');
  if (savedEnabled !== null) {
    slackWebhookEnabled = savedEnabled === 'true';
    console.log('Slack Webhook有効状態を読み込みました:', slackWebhookEnabled);
  }
  
  const savedTaskCompleteEnabled = localStorage.getItem('slackTaskCompleteEnabled');
  if (savedTaskCompleteEnabled !== null) {
    slackTaskCompleteEnabled = savedTaskCompleteEnabled === 'true';
    console.log('Slackタスク完了通知有効状態を読み込みました:', slackTaskCompleteEnabled);
  }
}

// AI APIキーを読み込む
function loadApiKey() {
  const savedApiKey = localStorage.getItem('aiApiKey');
  if (savedApiKey) {
    apiKey = savedApiKey;
    console.log('AI APIキーを読み込みました');
  }
}

// Always On Top設定を読み込む
function loadAlwaysOnTopSetting() {
  const savedSetting = localStorage.getItem('alwaysOnTop');
  if (savedSetting !== null) {
    alwaysOnTop = savedSetting === 'true';
  }
  // メインプロセスに設定を適用
  ipcRenderer.send('set-always-on-top', alwaysOnTop);
  console.log('Always On Top設定を読み込みました:', alwaysOnTop);
}

// 保存先と自動保存設定を読み込む
function loadSaveSettings() {
  const savedLocation = localStorage.getItem('saveLocation');
  if (savedLocation) {
    saveLocation = savedLocation;
  }
  
  const savedAutoSave = localStorage.getItem('autoSaveEnabled');
  if (savedAutoSave !== null) {
    autoSaveEnabled = savedAutoSave === 'true';
  }
  
  console.log('保存先を読み込みました:', saveLocation);
  console.log('自動保存設定を読み込みました:', autoSaveEnabled);
  
  // 自動保存が有効な場合、タイマーを開始
  if (autoSaveEnabled && saveLocation) {
    startAutoSaveTimer();
  }
}

// データを生成する共通関数
function generateSaveData() {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    categories: categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      isCollapsed: cat.isCollapsed
    })),
    stopwatches: stopwatches.map(sw => ({
      id: sw.id,
      categoryId: sw.categoryId,
      taskName: sw.taskName,
      elapsedSeconds: sw.elapsedSeconds,
      targetSeconds: sw.targetSeconds,
      isCompleted: sw.isCompleted
    })),
    nextCategoryId: nextCategoryId,
    nextStopwatchId: nextStopwatchId
  };
}

// 自動保存タイマーを開始
function startAutoSaveTimer() {
  // 既存のタイマーがあればクリア
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
  
  // 15分 = 900000ミリ秒
  const INTERVAL = 15 * 60 * 1000;
  
  console.log('自動保存タイマーを開始しました（15分間隔）');
  
  // 15分ごとに自動保存を実行
  autoSaveTimer = setInterval(() => {
    performAutoSave();
  }, INTERVAL);
}

// 自動保存タイマーを停止
function stopAutoSaveTimer() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
    console.log('自動保存タイマーを停止しました');
  }
}

// 自動保存を実行
async function performAutoSave() {
  // 自動保存が無効、または保存先が未設定の場合はスキップ
  if (!autoSaveEnabled || !saveLocation) {
    console.log('自動保存をスキップ: 無効または保存先未設定');
    return;
  }
  
  try {
    const data = generateSaveData();
    const jsonString = JSON.stringify(data, null, 2);
    
    // IPCを使って自動保存
    const result = await ipcRenderer.invoke('auto-save-data', {
      saveLocation: saveLocation,
      data: jsonString
    });
    
    if (result.success) {
      console.log('自動保存しました:', result.filePath);
    } else {
      console.error('自動保存に失敗しました:', result.error);
    }
  } catch (error) {
    console.error('自動保存中にエラーが発生しました:', error);
  }
}

// データエクスポート関数
async function exportData() {
  const data = generateSaveData();
  
  const jsonString = JSON.stringify(data, null, 2);
  
  // ファイル名（日時を含める）
  const now = new Date();
  const defaultFilename = `stopwatch_data_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;
  
  try {
    // IPCを使って保存ダイアログを表示
    const result = await ipcRenderer.invoke('save-data-file', {
      data: jsonString,
      defaultFilename: defaultFilename
    });
    
    if (result.canceled) {
      console.log('保存がキャンセルされました');
      return;
    }
    
    if (result.success) {
      console.log('データをエクスポートしました:', result.filePath);
      alert(`データをエクスポートしました\n\n保存先:\n${result.filePath}`);
    } else {
      console.error('エクスポートに失敗しました:', result.error);
      alert(`データのエクスポートに失敗しました\n\nエラー: ${result.error}`);
    }
  } catch (error) {
    console.error('エクスポート中にエラーが発生しました:', error);
    alert(`データのエクスポート中にエラーが発生しました\n\nエラー: ${error.message}`);
  }
}

// データインポート関数
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // データの検証
      if (!data.categories || !data.stopwatches) {
        throw new Error('無効なデータ形式です');
      }
      
      // 確認ダイアログ
      const confirmMessage = `データをインポートしますか？\n\n` +
        `カテゴリ: ${data.categories.length}個\n` +
        `タイマー: ${data.stopwatches.length}個\n\n` +
        `現在のデータは削除されます。`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // 既存のタイマーをすべて停止
      stopwatches.forEach(sw => sw.stop());
      
      // 現在動作中のストップウォッチIDをクリア
      currentRunningStopwatchId = null;
      
      // データをクリア
      categories.length = 0;
      stopwatches.length = 0;
      
      // IDカウンターを復元
      if (data.nextCategoryId) nextCategoryId = data.nextCategoryId;
      if (data.nextStopwatchId) nextStopwatchId = data.nextStopwatchId;
      
      // カテゴリを復元
      if (data.categories && data.categories.length > 0) {
        data.categories.forEach(catData => {
          const category = new Category(catData.id, catData.name);
          category.isCollapsed = catData.isCollapsed || false;
          categories.push(category);
        });
      }
      
      // タイマーを復元
      if (data.stopwatches && data.stopwatches.length > 0) {
        data.stopwatches.forEach(swData => {
          const stopwatch = new Stopwatch(swData.id, swData.categoryId);
          stopwatch.taskName = swData.taskName || '';
          stopwatch.elapsedSeconds = swData.elapsedSeconds || 0;
          // targetSecondsは null の可能性があるので || 0 を使わない
          stopwatch.targetSeconds = swData.targetSeconds !== undefined ? swData.targetSeconds : null;
          stopwatch.isCompleted = swData.isCompleted || false;
          // 確実に停止状態にする
          stopwatch.isRunning = false;
          stopwatch.isPaused = false;
          stopwatch.interval = null;
          stopwatches.push(stopwatch);
        });
      }
      
      // UIをクリアして再構築
      timersContainer.innerHTML = '';
      renderCategories();
      
      // 全てのカードから running クラスを削除（念のため）
      document.querySelectorAll('.timer-card').forEach(card => {
        card.classList.remove('running');
      });
      
      // 作業完了状態を復元
      stopwatches.forEach(sw => {
        if (sw.isCompleted) {
          const card = document.querySelector(`.timer-card[data-timer-id="${sw.id}"]`);
          if (card) {
            card.classList.add('completed');
            const toggleBtn = card.querySelector('.toggle-btn');
            if (toggleBtn) toggleBtn.disabled = true;
          }
        }
      });
      
      // 全てのタイマーのボタン表示を更新
      stopwatches.forEach(sw => {
        sw.updateButtons();
      });
      
      updateTotalTime();
      updateTargetTotalTime();
      updateAllCategoryTimes();
      
      console.log('データをインポートしました:', {
        categories: categories.length,
        stopwatches: stopwatches.length
      });
      
      alert(`データをインポートしました\n\nカテゴリ: ${categories.length}個\nタイマー: ${stopwatches.length}個`);
      
    } catch (error) {
      console.error('データのインポートに失敗しました:', error);
      alert(`データのインポートに失敗しました\n\nエラー: ${error.message}`);
    }
  });
  
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// UIを再構築する関数
function renderCategories() {
  // 空の状態メッセージを削除
  const emptyState = timersContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // カテゴリがある場合
  if (categories.length > 0) {
    categories.forEach(category => {
      const categoryContainer = createCategoryContainer(category);
      timersContainer.appendChild(categoryContainer);
      
      // カテゴリに属するタイマーを追加
      const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === category.id);
      const categoryTimers = categoryContainer.querySelector('.category-timers');
      
      if (categoryStopwatches.length > 0) {
        // 空の状態メッセージを削除
        const catEmptyState = categoryTimers.querySelector('.category-empty-state');
        if (catEmptyState) {
          catEmptyState.remove();
        }
        
        categoryStopwatches.forEach(stopwatch => {
          const card = createStopwatchCard(stopwatch, false); // autoEditはfalse
          categoryTimers.appendChild(card);
        });
      }
    });
  }
  
  // カテゴリに属さないタイマーを追加
  const uncategorizedStopwatches = stopwatches.filter(sw => !sw.categoryId);
  if (uncategorizedStopwatches.length > 0) {
    uncategorizedStopwatches.forEach(stopwatch => {
      const card = createStopwatchCard(stopwatch, false);
      timersContainer.appendChild(card);
    });
  }
  
  // 何もない場合は空の状態を表示
  if (categories.length === 0 && stopwatches.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = '「カテゴリを追加」からスタート';
    timersContainer.appendChild(emptyState);
  }
}

// 初期化時にURLと設定を読み込む
loadSlackWebhookUrl();
loadApiKey();
loadAlwaysOnTopSetting();
loadSaveSettings();

const menuBtn = document.getElementById('menuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const addCategoryMenuItem = document.getElementById('addCategoryMenuItem');
const addTimerMenuItem = document.getElementById('addTimerMenuItem');
const settingsMenuItem = document.getElementById('settingsMenuItem');
const slackNotificationMenuItem = document.getElementById('slackNotificationMenuItem');
const alwaysOnTopToggle = document.getElementById('alwaysOnTopToggle');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');
const timersContainer = document.getElementById('timersContainer');
const totalTimeDisplay = document.getElementById('totalTimeDisplay');
const targetTotalDisplay = document.getElementById('targetTotalDisplay');

// カテゴリクラス
class Category {
  constructor(id, name = '新しいカテゴリ') {
    this.id = id;
    this.name = name;
    this.isCollapsed = false; // 折りたたみ状態
  }
  
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
}

// ストップウォッチクラス
class Stopwatch {
  constructor(id, categoryId = null) {
    this.id = id;
    this.categoryId = categoryId; // 所属カテゴリID
    this.elapsedSeconds = 0; // 経過時間（秒）
    this.interval = null;
    this.isRunning = false;
    this.isPaused = false;
    this.taskName = ''; // タスク名
    this.targetSeconds = null; // 目標時間（秒）
    this.targetReached = false; // 目標達成フラグ
    this.isCompleted = false; // 作業完了フラグ
  }

  start() {
    // 作業完了している場合は開始できない
    if (this.isCompleted) {
      return;
    }

    // 他のストップウォッチが動作中なら停止させる
    if (currentRunningStopwatchId !== null && currentRunningStopwatchId !== this.id) {
      const runningStopwatch = stopwatches.find(sw => sw.id === currentRunningStopwatchId);
      if (runningStopwatch) {
        runningStopwatch.pause();
      }
    }

    if (!this.isRunning) {
      // 新規開始
      this.isRunning = true;
      this.isPaused = false;
    } else if (this.isPaused) {
      // 再開
      this.isPaused = false;
    }

    // このストップウォッチを動作中として記録
    currentRunningStopwatchId = this.id;

    this.interval = setInterval(() => {
      this.elapsedSeconds++;
      this.updateDisplay();
      
      // 目標時間達成チェック
      if (this.checkTargetReached()) {
        // 通知を表示
        const notification = new Notification('⏱️ 目標時間達成！', {
          body: `「${this.taskName || 'タスク'}」が目標時間に達しました。`,
          silent: false
        });
      }
    }, 1000);

    this.updateButtons();
    
    // Slack通知を送信（開始）
    sendSlackActivityNotification(this, 'start');
  }

  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isPaused = true;
      
      // このストップウォッチが動作中だった場合、動作中IDをクリア
      if (currentRunningStopwatchId === this.id) {
        currentRunningStopwatchId = null;
      }
      
      this.updateButtons();
      
      // Slack通知を送信（一時停止）
      sendSlackActivityNotification(this, 'pause');
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    
    // このストップウォッチが動作中だった場合、動作中IDをクリア
    if (currentRunningStopwatchId === this.id) {
      currentRunningStopwatchId = null;
    }
  }

  clear() {
    this.stop();
    this.elapsedSeconds = 0;
    this.updateDisplay();
    this.updateButtons();
  }

  updateDisplay() {
    const element = document.querySelector(`[data-timer-id="${this.id}"] .timer-display`);
    if (element) {
      element.textContent = this.formatTime(this.elapsedSeconds);
    }
    // 合計時間も更新
    updateTotalTime();
  }

  updateButtons() {
    const card = document.querySelector(`[data-timer-id="${this.id}"]`);
    if (!card) return;

    const toggleBtn = card.querySelector('.toggle-btn, .start-btn, .pause-btn');
    if (!toggleBtn) return;

    const icon = toggleBtn.querySelector('.material-icons');
    if (!icon) return;

    if (this.isRunning && !this.isPaused) {
      // 実行中：一時停止アイコンを表示
      icon.textContent = 'pause';
      toggleBtn.title = '一時停止';
      toggleBtn.className = 'pause-btn';
      card.classList.add('running'); // ハイライト表示
    } else {
      // 停止中：再生アイコンを表示
      icon.textContent = 'play_arrow';
      toggleBtn.title = 'スタート';
      toggleBtn.className = 'start-btn';
      card.classList.remove('running'); // ハイライト解除
    }
  }

  formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  setTaskName(name) {
    this.taskName = name;
  }

  setTargetTime(hours, minutes, seconds) {
    if (hours === '' && minutes === '' && seconds === '') {
      this.targetSeconds = null;
      this.targetReached = false;
      return;
    }
    
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    this.targetSeconds = h * 3600 + m * 60 + s;
    this.targetReached = false;
  }

  checkTargetReached() {
    if (this.targetSeconds !== null && !this.targetReached && this.elapsedSeconds >= this.targetSeconds) {
      this.targetReached = true;
      return true;
    }
    return false;
  }
}

// ストップウォッチを追加
function addStopwatch(categoryId = null, autoEdit = true) {
  const stopwatch = new Stopwatch(nextStopwatchId++, categoryId);
  stopwatches.push(stopwatch);

  // ストップウォッチカードを作成
  const card = createStopwatchCard(stopwatch, autoEdit);

  if (categoryId) {
    // カテゴリ内に追加
    const categoryTimers = document.querySelector(`.category-timers[data-category-id="${categoryId}"]`);
    if (categoryTimers) {
      // 空の状態メッセージを削除
      const emptyState = categoryTimers.querySelector('.category-empty-state');
      if (emptyState) {
        emptyState.remove();
      }
      categoryTimers.appendChild(card);
    }
  } else {
    // 通常のコンテナに追加（カテゴリなし）
    const emptyState = timersContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    timersContainer.appendChild(card);
  }
}

// ストップウォッチカードのHTML作成
function createStopwatchCard(stopwatch, autoEdit = false) {
  const card = document.createElement('div');
  card.className = 'timer-card';
  card.setAttribute('data-timer-id', stopwatch.id);
  card.setAttribute('draggable', 'true');

  card.innerHTML = `
    <button class="timer-menu-btn-top" title="メニュー" data-timer-id="${stopwatch.id}"><span class="material-icons">more_vert</span></button>
    <div class="task-name-container">
      <span class="drag-handle-small" title="ドラッグして移動">⋮⋮</span>
      <span class="task-name-display">タスク名なし</span>
      <input type="text" class="task-name-input hidden" placeholder="タスク名" value="">
    </div>
    <div class="target-time-container">
      <span class="target-label">予定:</span>
      <span class="target-display">--:--:--</span>
      <div class="target-input-group hidden">
        <input type="number" class="target-input target-hours" placeholder="時" min="0" max="23" value="">
        <span class="target-separator">:</span>
        <input type="number" class="target-input target-minutes" placeholder="分" min="0" max="59" value="">
        <span class="target-separator">:</span>
        <input type="number" class="target-input target-seconds" placeholder="秒" min="0" max="59" value="">
      </div>
    </div>
    <div class="timer-main-row">
      <div class="timer-time-container">
        <div class="timer-display">${stopwatch.formatTime(stopwatch.elapsedSeconds)}</div>
        <div class="timer-input-group hidden">
          <input type="number" class="timer-input timer-input-hours" placeholder="時" min="0" max="999" value="">
          <span class="timer-separator">:</span>
          <input type="number" class="timer-input timer-input-minutes" placeholder="分" min="0" max="59" value="">
          <span class="timer-separator">:</span>
          <input type="number" class="timer-input timer-input-seconds" placeholder="秒" min="0" max="59" value="">
        </div>
      </div>
      <div class="timer-controls">
        <button class="toggle-btn" title="スタート"><span class="material-icons">play_arrow</span></button>
      </div>
    </div>
  `;

  // イベントリスナーを追加
  const taskNameDisplay = card.querySelector('.task-name-display');
  const taskNameInput = card.querySelector('.task-name-input');
  const targetDisplay = card.querySelector('.target-display');
  const targetInputGroup = card.querySelector('.target-input-group');
  const targetHours = card.querySelector('.target-hours');
  const targetMinutes = card.querySelector('.target-minutes');
  const targetSeconds = card.querySelector('.target-seconds');
  const toggleBtn = card.querySelector('.toggle-btn');
  const timerDisplay = card.querySelector('.timer-display');
  const timerInputGroup = card.querySelector('.timer-input-group');
  const timerInputHours = card.querySelector('.timer-input-hours');
  const timerInputMinutes = card.querySelector('.timer-input-minutes');
  const timerInputSeconds = card.querySelector('.timer-input-seconds');
  const timerMenuBtn = card.querySelector('.timer-menu-btn-top');
  
  // 編集モードの状態
  let isEditing = false;
  
  // 表示を更新する関数
  const updateDisplays = () => {
    // タスク名の表示を更新
    taskNameDisplay.textContent = stopwatch.taskName || 'タスク名なし';
    
    // 目標時間の表示を更新
    if (stopwatch.targetSeconds !== null && stopwatch.targetSeconds > 0) {
      targetDisplay.textContent = stopwatch.formatTime(stopwatch.targetSeconds);
    } else {
      targetDisplay.textContent = '--:--:--';
    }
    
    // タイマー入力フィールドの値を更新
    const totalSeconds = stopwatch.elapsedSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    timerInputHours.value = hours;
    timerInputMinutes.value = minutes;
    timerInputSeconds.value = seconds;
  };
  
  // 初期表示を更新
  updateDisplays();

  // タイマーメニューの開閉
  timerMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 通常モードならメニューを表示
    showTimerOverlayMenu(stopwatch, timerMenuBtn, toggleEditMode);
  });

  // タスク名の変更
  taskNameInput.addEventListener('input', (e) => {
    stopwatch.setTaskName(e.target.value);
    updateDisplays();
  });

  // 目標時間のバリデーション関数
  const validateTargetInput = (input, max) => {
    let value = parseInt(input.value) || 0;
    if (value < 0) value = 0;
    if (value > max) value = max;
    if (input.value !== '' && value !== parseInt(input.value)) {
      input.value = value;
    }
  };

  // 目標時間の入力イベント
  const updateTargetTime = () => {
    // バリデーション
    validateTargetInput(targetHours, 23);
    validateTargetInput(targetMinutes, 59);
    validateTargetInput(targetSeconds, 59);
    
    stopwatch.setTargetTime(targetHours.value, targetMinutes.value, targetSeconds.value);
    updateTimerDisplay();
    updateTargetTotalTime();
    updateCategoryTime(stopwatch.categoryId);
    updateDisplays();
  };
  
  targetHours.addEventListener('input', updateTargetTime);
  targetMinutes.addEventListener('input', updateTargetTime);
  targetSeconds.addEventListener('input', updateTargetTime);
  
  // blurイベントでもバリデーション（フォーカスが外れた時）
  targetHours.addEventListener('blur', () => validateTargetInput(targetHours, 23));
  targetMinutes.addEventListener('blur', () => validateTargetInput(targetMinutes, 59));
  targetSeconds.addEventListener('blur', () => validateTargetInput(targetSeconds, 59));

  // タイマー入力のバリデーション関数
  const validateTimerInput = (input, max) => {
    let value = parseInt(input.value) || 0;
    if (value < 0) value = 0;
    if (value > max) value = max;
    if (input.value !== '' && value !== parseInt(input.value)) {
      input.value = value;
    }
  };

  // タイマー時間の入力イベント
  const updateTimerElapsed = () => {
    // バリデーション
    validateTimerInput(timerInputHours, 999);
    validateTimerInput(timerInputMinutes, 59);
    validateTimerInput(timerInputSeconds, 59);
    
    const hours = parseInt(timerInputHours.value) || 0;
    const minutes = parseInt(timerInputMinutes.value) || 0;
    const seconds = parseInt(timerInputSeconds.value) || 0;
    
    stopwatch.elapsedSeconds = hours * 3600 + minutes * 60 + seconds;
    updateTimerDisplay();
    updateTotalTime();
    updateCategoryTime(stopwatch.categoryId);
  };
  
  timerInputHours.addEventListener('input', updateTimerElapsed);
  timerInputMinutes.addEventListener('input', updateTimerElapsed);
  timerInputSeconds.addEventListener('input', updateTimerElapsed);
  
  // blurイベントでもバリデーション（フォーカスが外れた時）
  timerInputHours.addEventListener('blur', () => validateTimerInput(timerInputHours, 999));
  timerInputMinutes.addEventListener('blur', () => validateTimerInput(timerInputMinutes, 59));
  timerInputSeconds.addEventListener('blur', () => validateTimerInput(timerInputSeconds, 59));

  // タイマー表示の更新（目標時間との比較も含む）
  const updateTimerDisplay = () => {
    timerDisplay.textContent = stopwatch.formatTime(stopwatch.elapsedSeconds);
    
    // 目標時間が設定されている場合の処理
    if (stopwatch.targetSeconds !== null) {
      if (stopwatch.elapsedSeconds >= stopwatch.targetSeconds) {
        card.classList.add('target-reached');
      } else {
        card.classList.remove('target-reached');
      }
    } else {
      card.classList.remove('target-reached');
    }
  };
  
  // 初回表示更新
  updateTimerDisplay();

  // トグルボタンの表示を更新
  const updateToggleButton = () => {
    const icon = toggleBtn.querySelector('.material-icons');
    // confirm-btnクラスを削除
    toggleBtn.classList.remove('confirm-btn');
    
    if (stopwatch.isRunning && !stopwatch.isPaused) {
      // 実行中：一時停止アイコンを表示
      icon.textContent = 'pause';
      toggleBtn.title = '一時停止';
      toggleBtn.className = 'pause-btn';
    } else {
      // 停止中：再生アイコンを表示
      icon.textContent = 'play_arrow';
      toggleBtn.title = 'スタート';
      toggleBtn.className = 'start-btn';
    }
  };

  // ボタンイベント
  toggleBtn.addEventListener('click', () => {
    // 編集モードの場合は確定処理
    if (toggleBtn.classList.contains('confirm-btn')) {
      toggleEditMode();
      return;
    }
    
    // 通常モードの場合は再生/一時停止
    if (stopwatch.isRunning && !stopwatch.isPaused) {
      // 実行中なら一時停止
      stopwatch.pause();
    } else {
      // 停止中なら開始
      stopwatch.start();
    }
    updateToggleButton();
  });


  // 編集モードの切り替え関数
  const toggleEditMode = () => {
    isEditing = !isEditing;
    
    if (isEditing) {
      // 編集モードON: inputを表示、displayを非表示
      taskNameDisplay.classList.add('hidden');
      taskNameInput.classList.remove('hidden');
      targetDisplay.classList.add('hidden');
      targetInputGroup.classList.remove('hidden');
      timerDisplay.classList.add('hidden');
      timerInputGroup.classList.remove('hidden');
      
      // inputの値を設定
      taskNameInput.value = stopwatch.taskName || '';
      if (stopwatch.targetSeconds !== null) {
        const hours = Math.floor(stopwatch.targetSeconds / 3600);
        const minutes = Math.floor((stopwatch.targetSeconds % 3600) / 60);
        const seconds = stopwatch.targetSeconds % 60;
        targetHours.value = hours > 0 ? hours : '';
        targetMinutes.value = minutes > 0 ? minutes : '';
        targetSeconds.value = seconds > 0 ? seconds : '';
      } else {
        targetHours.value = '';
        targetMinutes.value = '';
        targetSeconds.value = '';
      }
      
      // タイマー入力フィールドの値を設定
      const elapsedHours = Math.floor(stopwatch.elapsedSeconds / 3600);
      const elapsedMinutes = Math.floor((stopwatch.elapsedSeconds % 3600) / 60);
      const elapsedSecs = stopwatch.elapsedSeconds % 60;
      timerInputHours.value = elapsedHours;
      timerInputMinutes.value = elapsedMinutes;
      timerInputSeconds.value = elapsedSecs;
      
      taskNameInput.focus();
      
      // メニューボタンを非表示
      timerMenuBtn.classList.add('hidden');
      
      // 再生ボタンを確定ボタンに変更
      const icon = toggleBtn.querySelector('.material-icons');
      icon.textContent = 'check';
      toggleBtn.title = '確定';
      toggleBtn.classList.add('confirm-btn');
      toggleBtn.disabled = false;
    } else {
      // 編集モードOFF: displayを表示、inputを非表示
      taskNameDisplay.classList.remove('hidden');
      taskNameInput.classList.add('hidden');
      targetDisplay.classList.remove('hidden');
      targetInputGroup.classList.add('hidden');
      timerDisplay.classList.remove('hidden');
      timerInputGroup.classList.add('hidden');
      
      // 表示を更新
      updateDisplays();
      
      // メニューボタンを表示
      timerMenuBtn.classList.remove('hidden');
      
      // 確定ボタンを再生ボタンに戻す
      updateToggleButton();
    }
  };

  // ドラッグ&ドロップイベント（タイマーカード）
  card.addEventListener('dragstart', handleTimerDragStart);
  card.addEventListener('dragover', handleTimerDragOver);
  card.addEventListener('drop', handleTimerDrop);
  card.addEventListener('dragend', handleDragEnd);

  // 自動編集モード
  if (autoEdit) {
    // 少し遅延させてDOMに追加されてから編集モードを開始
    setTimeout(() => {
      toggleEditMode();
    }, 100);
  }

  return card;
}

// ストップウォッチを削除
function removeStopwatch(stopwatchId) {
  const stopwatch = stopwatches.find(t => t.id === stopwatchId);
  if (!stopwatch) return;

  // 確認ダイアログを表示
  const taskName = stopwatch.taskName || 'タスク名なし';
  const confirmMessage = `「${taskName}」を削除してもよろしいですか？`;
  if (!confirm(confirmMessage)) {
    return; // キャンセルされた場合は削除しない
  }

  const categoryId = stopwatch.categoryId;
  
  const index = stopwatches.findIndex(t => t.id === stopwatchId);
  if (index !== -1) {
    stopwatches[index].stop(); // 削除前にストップウォッチを停止
    stopwatches.splice(index, 1);
  }

  const card = document.querySelector(`[data-timer-id="${stopwatchId}"]`);
  if (card) {
    card.remove();
  }

  // カテゴリ内が空になったら空の状態を表示
  if (categoryId) {
    const categoryTimers = document.querySelector(`.category-timers[data-category-id="${categoryId}"]`);
    const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
    if (categoryTimers && categoryStopwatches.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'category-empty-state';
      emptyState.textContent = '「+」でタイマーを追加';
      categoryTimers.appendChild(emptyState);
    }
  } else {
    // カテゴリ外のストップウォッチがすべてなくなり、カテゴリもない場合
    const categorylessStopwatches = stopwatches.filter(sw => !sw.categoryId);
    if (categorylessStopwatches.length === 0 && categories.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = '「カテゴリを追加」からスタート';
      timersContainer.appendChild(emptyState);
    }
  }
  
  updateTotalTime();
}

// 合計時間を更新
function updateTotalTime() {
  const totalSeconds = stopwatches.reduce((sum, sw) => sum + sw.elapsedSeconds, 0);
  if (totalTimeDisplay) {
    totalTimeDisplay.textContent = formatTime(totalSeconds);
  }
  updateTargetTotalTime();
  updateAllCategoryTimes();
}

// 目標時間の合計を更新
function updateTargetTotalTime() {
  const targetTotalSeconds = stopwatches.reduce((sum, sw) => {
    return sum + (sw.targetSeconds || 0);
  }, 0);
  
  if (targetTotalDisplay) {
    if (targetTotalSeconds > 0) {
      targetTotalDisplay.textContent = formatTime(targetTotalSeconds);
    } else {
      targetTotalDisplay.textContent = '--:--:--';
    }
  }
}

// 全カテゴリの時間を更新
function updateAllCategoryTimes() {
  categories.forEach(category => {
    updateCategoryTime(category.id);
  });
}

// カテゴリごとの時間を更新
function updateCategoryTime(categoryId) {
  const categoryContainer = document.querySelector(`.category-container[data-category-id="${categoryId}"]`);
  if (!categoryContainer) return;
  
  const elapsedTimeElement = categoryContainer.querySelector('.category-elapsed-time');
  const targetTimeElement = categoryContainer.querySelector('.category-target-time');
  
  // そのカテゴリに属するストップウォッチを取得
  const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
  
  // 経過時間の合計
  const elapsedTotal = categoryStopwatches.reduce((sum, sw) => sum + sw.elapsedSeconds, 0);
  
  // 目標時間の合計
  const targetTotal = categoryStopwatches.reduce((sum, sw) => sum + (sw.targetSeconds || 0), 0);
  
  // 表示を更新
  if (elapsedTimeElement) {
    elapsedTimeElement.textContent = formatTime(elapsedTotal);
  }
  
  if (targetTimeElement) {
    if (targetTotal > 0) {
      targetTimeElement.textContent = `/ ${formatTime(targetTotal)}`;
    } else {
      targetTimeElement.textContent = '/ --:--:--';
    }
  }
}

// 時間フォーマット（グローバル関数）
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// カテゴリを作成
function createCategoryContainer(category) {
  const container = document.createElement('div');
  container.className = 'category-container';
  container.setAttribute('data-category-id', category.id);
  container.setAttribute('draggable', 'true');

  container.innerHTML = `
    <div class="category-header">
      <button class="collapse-btn" title="折りたたみ">
        <span class="material-icons collapse-icon">expand_more</span>
      </button>
      <span class="drag-handle" title="ドラッグして移動">⋮⋮</span>
      <div class="category-info">
        <div class="category-name-wrapper">
          <span class="category-name-display">${category.name}</span>
          <input type="text" class="category-name-input hidden" value="${category.name}" placeholder="カテゴリ名">
        </div>
        <div class="category-time-summary">
          <span class="category-elapsed-time">00:00:00</span>
          <span class="category-target-time">/ --:--:--</span>
        </div>
      </div>
      <div class="category-controls">
        <button class="category-confirm-btn hidden" title="確定"><span class="material-icons">check</span></button>
        <button class="category-menu-btn" title="メニュー" data-category-id="${category.id}">
          <span class="material-icons">more_vert</span>
        </button>
      </div>
    </div>
    <div class="category-timers" data-category-id="${category.id}">
      <div class="category-empty-state">「メニューからタイマーを追加」</div>
    </div>
  `;

  // イベントリスナー
  const collapseBtn = container.querySelector('.collapse-btn');
  const collapseIcon = container.querySelector('.collapse-icon');
  const categoryTimers = container.querySelector('.category-timers');
  const nameDisplay = container.querySelector('.category-name-display');
  const nameInput = container.querySelector('.category-name-input');
  const categoryMenuBtn = container.querySelector('.category-menu-btn');
  const categoryConfirmBtn = container.querySelector('.category-confirm-btn');
  
  // カテゴリ編集モードの状態
  let isCategoryEditing = false;

  // 折りたたみボタン
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    category.toggleCollapse();
    
    if (category.isCollapsed) {
      categoryTimers.classList.add('collapsed');
      collapseIcon.textContent = 'chevron_right';
      container.classList.add('collapsed');
    } else {
      categoryTimers.classList.remove('collapsed');
      collapseIcon.textContent = 'expand_more';
      container.classList.remove('collapsed');
    }
  });

  nameInput.addEventListener('input', (e) => {
    category.name = e.target.value;
    nameDisplay.textContent = e.target.value;
  });

  // カテゴリ編集モードの切り替え関数
  const toggleCategoryEditMode = () => {
    isCategoryEditing = !isCategoryEditing;
    
    if (isCategoryEditing) {
      // 編集モードON: inputを表示、displayを非表示
      nameDisplay.classList.add('hidden');
      nameInput.classList.remove('hidden');
      nameInput.value = category.name;
      nameInput.focus();
      nameInput.select();
      
      // メニューボタンを非表示、確定ボタンを表示
      categoryMenuBtn.classList.add('hidden');
      categoryConfirmBtn.classList.remove('hidden');
    } else {
      // 編集モードOFF: displayを表示、inputを非表示
      nameDisplay.classList.remove('hidden');
      nameInput.classList.add('hidden');
      nameDisplay.textContent = category.name;
      
      // 確定ボタンを非表示、メニューボタンを表示
      categoryConfirmBtn.classList.add('hidden');
      categoryMenuBtn.classList.remove('hidden');
    }
  };

  // 確定ボタンイベント
  categoryConfirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCategoryEditMode();
  });

  // カテゴリメニューの開閉
  categoryMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showCategoryOverlayMenu(category, categoryMenuBtn, toggleCategoryEditMode);
  });

  // ドラッグ&ドロップイベント（カテゴリ）
  container.addEventListener('dragstart', handleCategoryDragStart);
  container.addEventListener('dragover', handleCategoryDragOver);
  container.addEventListener('drop', handleCategoryDrop);
  container.addEventListener('dragend', handleDragEnd);

  return container;
}

// カテゴリを追加
function addCategory() {
  const category = new Category(nextCategoryId++);
  categories.push(category);

  // 空の状態メッセージを削除
  const emptyState = timersContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const categoryContainer = createCategoryContainer(category);
  timersContainer.appendChild(categoryContainer);
}

// カテゴリを削除
function removeCategory(categoryId) {
  // 確認ダイアログを表示
  const category = categories.find(c => c.id === categoryId);
  const categoryName = category ? category.name : 'カテゴリ';
  const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
  const timerCount = categoryStopwatches.length;
  
  let confirmMessage = `「${categoryName}」を削除してもよろしいですか？`;
  if (timerCount > 0) {
    confirmMessage += `\n（カテゴリ内の${timerCount}個のタイマーも削除されます）`;
  }
  
  if (!confirm(confirmMessage)) {
    return; // キャンセルされた場合は削除しない
  }

  // カテゴリ内のストップウォッチをすべて削除
  categoryStopwatches.forEach(sw => {
    sw.stop();
  });
  stopwatches = stopwatches.filter(sw => sw.categoryId !== categoryId);

  // カテゴリを配列から削除
  const index = categories.findIndex(c => c.id === categoryId);
  if (index !== -1) {
    categories.splice(index, 1);
  }

  // DOM から削除
  const container = document.querySelector(`[data-category-id="${categoryId}"]`);
  if (container) {
    container.remove();
  }

  // カテゴリがなくなったら空の状態を表示
  if (categories.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = '「カテゴリを追加」からスタート';
    timersContainer.appendChild(emptyState);
  }

  updateTotalTime();
}

// ドラッグ&ドロップ関連の変数
let draggedElement = null;
let draggedType = null; // 'category' or 'timer'

// カテゴリのドラッグ開始
function handleCategoryDragStart(e) {
  draggedElement = e.currentTarget;
  draggedType = 'category';
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

// カテゴリのドラッグオーバー
function handleCategoryDragOver(e) {
  if (draggedType !== 'category') return;
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.currentTarget;
  if (target !== draggedElement && target.classList.contains('category-container')) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      target.style.borderTop = '3px solid #667eea';
      target.style.borderBottom = '';
    } else {
      target.style.borderBottom = '3px solid #667eea';
      target.style.borderTop = '';
    }
  }
  
  return false;
}

// カテゴリのドロップ
function handleCategoryDrop(e) {
  if (draggedType !== 'category') return;
  if (e.stopPropagation) e.stopPropagation();
  
  const target = e.currentTarget;
  if (draggedElement !== target) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      timersContainer.insertBefore(draggedElement, target);
    } else {
      timersContainer.insertBefore(draggedElement, target.nextSibling);
    }
    
    // カテゴリ配列の順序も更新
    reorderCategoriesArray();
  }
  
  return false;
}

// タイマーのドラッグ開始
function handleTimerDragStart(e) {
  draggedElement = e.currentTarget;
  draggedType = 'timer';
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

// タイマーのドラッグオーバー
function handleTimerDragOver(e) {
  if (draggedType !== 'timer') return;
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.currentTarget;
  if (target !== draggedElement && target.classList.contains('timer-card')) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      target.style.borderTop = '3px solid #667eea';
      target.style.borderBottom = '';
    } else {
      target.style.borderBottom = '3px solid #667eea';
      target.style.borderTop = '';
    }
  }
  
  return false;
}

// タイマーのドロップ
function handleTimerDrop(e) {
  if (draggedType !== 'timer') return;
  if (e.stopPropagation) e.stopPropagation();
  
  const target = e.currentTarget;
  if (draggedElement !== target) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const targetParent = target.parentElement;
    
    if (e.clientY < midpoint) {
      targetParent.insertBefore(draggedElement, target);
    } else {
      targetParent.insertBefore(draggedElement, target.nextSibling);
    }
    
    // タイマーのカテゴリIDを更新
    const newCategoryId = targetParent.getAttribute('data-category-id');
    const timerId = parseInt(draggedElement.getAttribute('data-timer-id'));
    const timer = stopwatches.find(sw => sw.id === timerId);
    if (timer) {
      timer.categoryId = newCategoryId ? parseInt(newCategoryId) : null;
    }
  }
  
  return false;
}

// カテゴリタイマーエリアへのドロップ対応
document.addEventListener('DOMContentLoaded', () => {
  timersContainer.addEventListener('dragover', (e) => {
    if (draggedType === 'timer') {
      const categoryTimers = e.target.closest('.category-timers');
      if (categoryTimers) {
        e.preventDefault();
        categoryTimers.style.background = 'rgba(102, 126, 234, 0.1)';
      }
    }
  });
  
  timersContainer.addEventListener('drop', (e) => {
    const categoryTimers = e.target.closest('.category-timers');
    if (categoryTimers && draggedType === 'timer') {
      e.preventDefault();
      e.stopPropagation();
      
      // 空の状態メッセージを削除
      const emptyState = categoryTimers.querySelector('.category-empty-state');
      if (emptyState) {
        emptyState.remove();
      }
      
      // タイマーを追加
      categoryTimers.appendChild(draggedElement);
      
      // タイマーのカテゴリIDを更新
      const newCategoryId = categoryTimers.getAttribute('data-category-id');
      const timerId = parseInt(draggedElement.getAttribute('data-timer-id'));
      const timer = stopwatches.find(sw => sw.id === timerId);
      if (timer) {
        timer.categoryId = newCategoryId ? parseInt(newCategoryId) : null;
      }
      
      categoryTimers.style.background = '';
    }
  });
});

// ドラッグ終了
function handleDragEnd(e) {
  e.currentTarget.style.opacity = '';
  
  // すべてのボーダーをクリア
  document.querySelectorAll('.category-container, .timer-card').forEach(el => {
    el.style.borderTop = '';
    el.style.borderBottom = '';
  });
  
  document.querySelectorAll('.category-timers').forEach(el => {
    el.style.background = '';
  });
  
  draggedElement = null;
  draggedType = null;
}

// カテゴリ配列の順序を更新
function reorderCategoriesArray() {
  const categoryElements = Array.from(document.querySelectorAll('.category-container'));
  const newOrder = categoryElements.map(el => {
    const id = parseInt(el.getAttribute('data-category-id'));
    return categories.find(c => c.id === id);
  }).filter(c => c);
  
  categories.length = 0;
  categories.push(...newOrder);
}

// メニューの開閉
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('hidden');
});

// メニュー外をクリックしたら閉じる
document.addEventListener('click', (e) => {
  // ヘッダーメニューを閉じる
  if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
    dropdownMenu.classList.add('hidden');
  }
  
  // カテゴリメニューをすべて閉じる
  const categoryMenus = document.querySelectorAll('.category-dropdown-menu');
  categoryMenus.forEach(menu => {
    const menuBtn = menu.parentElement.querySelector('.category-menu-btn');
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
});

// Escキーでメニューを閉じる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // メインメニューを閉じる
    if (!dropdownMenu.classList.contains('hidden')) {
      dropdownMenu.classList.add('hidden');
    }
    
    // オーバーレイメニュー（カテゴリ・タイマー）を閉じる
    const overlayMenu = document.querySelector('.timer-menu-overlay');
    if (overlayMenu) {
      overlayMenu.remove();
    }
  }
});

// メニュー項目のクリックイベント
addCategoryMenuItem.addEventListener('click', () => {
  addCategory();
  dropdownMenu.classList.add('hidden');
});

addTimerMenuItem.addEventListener('click', () => {
  addStopwatch(null);
  dropdownMenu.classList.add('hidden');
});

// Slack Webhook URL設定ダイアログ
const slackWebhookDialog = document.getElementById('slackWebhookDialog');
const slackWebhookInput = document.getElementById('slackWebhookInput');
const slackUsernameInput = document.getElementById('slackUsernameInput');
const slackWebhookEnabledCheckbox = document.getElementById('slackWebhookEnabled');
const slackTaskCompleteEnabledCheckbox = document.getElementById('slackTaskCompleteEnabled');
const slackWebhookSave = document.getElementById('slackWebhookSave');
const slackWebhookCancel = document.getElementById('slackWebhookCancel');
const sendSlackNotificationScheduleBtn = document.getElementById('sendSlackNotificationScheduleBtn');
const sendSlackNotificationActualBtn = document.getElementById('sendSlackNotificationActualBtn');

// Slack通知ダイアログ
const slackNotificationDialog = document.getElementById('slackNotificationDialog');
const slackNotificationClose = document.getElementById('slackNotificationClose');

// 設定ダイアログ
const settingsDialog = document.getElementById('settingsDialog');
const settingsClose = document.getElementById('settingsClose');
const openSlackSettingsBtn = document.getElementById('openSlackSettingsBtn');
const openApiKeySettingsBtn = document.getElementById('openApiKeySettingsBtn');
const openSaveLocationSettingsBtn = document.getElementById('openSaveLocationSettingsBtn');

// AI APIキー設定ダイアログ
const apiKeyDialog = document.getElementById('apiKeyDialog');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyOk = document.getElementById('apiKeyOk');
const apiKeyCancel = document.getElementById('apiKeyCancel');

// 保存先設定ダイアログ
const saveLocationDialog = document.getElementById('saveLocationDialog');
const saveLocationPath = document.getElementById('saveLocationPath');
const selectSaveLocationBtn = document.getElementById('selectSaveLocationBtn');
const autoSaveEnabledCheckbox = document.getElementById('autoSaveEnabled');
const saveLocationOk = document.getElementById('saveLocationOk');
const saveLocationClose = document.getElementById('saveLocationClose');

// データインポートダイアログ
const dataImportDialog = document.getElementById('dataImportDialog');
const importFileInput = document.getElementById('importFileInput');
const selectImportFileBtn = document.getElementById('selectImportFileBtn');
const selectedFileName = document.getElementById('selectedFileName');
const executeImportBtn = document.getElementById('executeImportBtn');
const dataImportClose = document.getElementById('dataImportClose');
const openDataImportBtn = document.getElementById('openDataImportBtn');

// 一時的な保存先（OK押下前）
let tempSaveLocation = '';
// 選択されたインポートファイル
let selectedImportFile = null;

// ダイアログを開く
function openSlackWebhookDialog() {
  slackWebhookInput.value = slackWebhookUrl || '';
  slackUsernameInput.value = slackUsername || '';
  slackWebhookEnabledCheckbox.checked = slackWebhookEnabled;
  slackTaskCompleteEnabledCheckbox.checked = slackTaskCompleteEnabled;
  slackWebhookDialog.classList.remove('hidden');
  slackWebhookInput.focus();
  dropdownMenu.classList.add('hidden');
}

// ダイアログを閉じる
function closeSlackWebhookDialog() {
  slackWebhookDialog.classList.add('hidden');
  slackWebhookInput.value = '';
  slackUsernameInput.value = '';
}

// Slack通知ダイアログを開く
function openSlackNotificationDialog() {
  slackNotificationDialog.classList.remove('hidden');
  dropdownMenu.classList.add('hidden');
}

// Slack通知ダイアログを閉じる
function closeSlackNotificationDialog() {
  slackNotificationDialog.classList.add('hidden');
}

// 設定ダイアログを開く
function openSettingsDialog() {
  settingsDialog.classList.remove('hidden');
  dropdownMenu.classList.add('hidden');
}

// 設定ダイアログを閉じる
function closeSettingsDialog() {
  settingsDialog.classList.add('hidden');
}

// AI APIキーダイアログを開く
function openApiKeyDialog() {
  apiKeyInput.value = apiKey || '';
  apiKeyDialog.classList.remove('hidden');
  apiKeyInput.focus();
  dropdownMenu.classList.add('hidden');
}

// AI APIキーダイアログを閉じる
function closeApiKeyDialog() {
  apiKeyDialog.classList.add('hidden');
}

// 保存先設定ダイアログを開く
function openSaveLocationDialog() {
  // 現在の保存先を表示
  tempSaveLocation = saveLocation;
  saveLocationPath.value = saveLocation || '';
  // 自動保存トグルの状態を設定
  autoSaveEnabledCheckbox.checked = autoSaveEnabled;
  saveLocationDialog.classList.remove('hidden');
}

// 保存先設定ダイアログを閉じる
function closeSaveLocationDialog() {
  saveLocationDialog.classList.add('hidden');
  // 一時保存先をクリア
  tempSaveLocation = '';
}

// データインポートダイアログを開く
function openDataImportDialog() {
  // ダイアログをリセット
  selectedFileName.textContent = '';
  selectedImportFile = null;
  executeImportBtn.disabled = true;
  dataImportDialog.classList.remove('hidden');
}

// データインポートダイアログを閉じる
function closeDataImportDialog() {
  dataImportDialog.classList.add('hidden');
  selectedFileName.textContent = '';
  selectedImportFile = null;
  executeImportBtn.disabled = true;
}

// 設定メニュー
if (settingsMenuItem) {
  settingsMenuItem.addEventListener('click', () => {
    openSettingsDialog();
  });
}

// Slack通知メニュー
if (slackNotificationMenuItem) {
  slackNotificationMenuItem.addEventListener('click', () => {
    openSlackNotificationDialog();
  });
}

// 保存先選択ボタン
if (selectSaveLocationBtn) {
  selectSaveLocationBtn.addEventListener('click', async () => {
    try {
      const result = await ipcRenderer.invoke('select-save-location');
      if (result) {
        // 一時的に保存先を保持（OKボタンを押すまで確定しない）
        tempSaveLocation = result;
        saveLocationPath.value = tempSaveLocation;
      }
    } catch (error) {
      console.error('保存先選択エラー:', error);
      alert('保存先の選択に失敗しました');
    }
  });
}

// 保存先設定OKボタン
if (saveLocationOk) {
  saveLocationOk.addEventListener('click', () => {
    let hasChanges = false;
    let message = '';
    
    // 保存先の変更をチェック
    if (tempSaveLocation && tempSaveLocation !== saveLocation) {
      saveLocation = tempSaveLocation;
      localStorage.setItem('saveLocation', saveLocation);
      hasChanges = true;
      message += `保存先を設定しました:\n${saveLocation}`;
    }
    
    // 自動保存の設定を保存
    const newAutoSaveEnabled = autoSaveEnabledCheckbox.checked;
    if (newAutoSaveEnabled !== autoSaveEnabled) {
      autoSaveEnabled = newAutoSaveEnabled;
      localStorage.setItem('autoSaveEnabled', autoSaveEnabled.toString());
      hasChanges = true;
      if (message) message += '\n\n';
      message += `自動保存を${autoSaveEnabled ? '有効' : '無効'}にしました`;
      console.log('自動保存設定を変更しました:', autoSaveEnabled);
    }
    
    // 自動保存タイマーを制御
    if (autoSaveEnabled && saveLocation) {
      // 自動保存を有効にする
      startAutoSaveTimer();
    } else {
      // 自動保存を無効にする
      stopAutoSaveTimer();
    }
    
    if (hasChanges) {
      // 成功メッセージを表示（alertのみ閉じて、ダイアログは開いたまま）
      alert(message);
    }
  });
}

// 保存先設定ダイアログを閉じる
if (saveLocationClose) {
  saveLocationClose.addEventListener('click', () => {
    closeSaveLocationDialog();
    if (openedFromSettings) {
      openedFromSettings = false;
      openSettingsDialog();
    }
  });
}

// 保存先設定ダイアログの外側クリックで閉じる
if (saveLocationDialog) {
  saveLocationDialog.addEventListener('click', (e) => {
    if (e.target === saveLocationDialog) {
      closeSaveLocationDialog();
    }
  });
}

// Slack通知を送信する関数（予定）
async function sendSlackNotificationSchedule() {
  // Slack Webhook URLが設定されているか確認
  if (!slackWebhookUrl) {
    alert('Slack Webhook URLが設定されていません。\n\nメインメニューから「Slack連携」で設定してください。');
    return;
  }
  
  // データが空の場合
  if (stopwatches.length === 0) {
    alert('送信するタイマーデータがありません。');
    return;
  }
  
  try {
    // マークダウン形式でメッセージを作成
    let message = '*本日の予定';
    if (slackUsername) {
      message += `（${slackUsername}）`;
    }
    message += '*\n\n';
    
    // カテゴリごとにタイマーを表示
    if (categories.length > 0) {
      categories.forEach(category => {
        const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === category.id);
        if (categoryStopwatches.length > 0) {
          message += `*📁 ${category.name}*\n`;
          
          categoryStopwatches.forEach(sw => {
            const taskName = sw.taskName || 'タスク名なし';
            
            if (sw.targetSeconds && sw.targetSeconds > 0) {
              const target = formatTimeForSlack(sw.targetSeconds);
              message += `  • ${taskName} (予定: ${target})\n`;
            } else {
              message += `  • ${taskName}\n`;
            }
          });
          
          message += '\n';
        }
      });
    }
    
    // カテゴリなしのタイマー
    const uncategorizedStopwatches = stopwatches.filter(sw => !sw.categoryId);
    if (uncategorizedStopwatches.length > 0) {
      message += '*📝 未分類*\n';
      
      uncategorizedStopwatches.forEach(sw => {
        const taskName = sw.taskName || 'タスク名なし';
        
        if (sw.targetSeconds && sw.targetSeconds > 0) {
          const target = formatTimeForSlack(sw.targetSeconds);
          message += `  • ${taskName} (予定: ${target})\n`;
        } else {
          message += `  • ${taskName}\n`;
        }
      });
    }
    
    // Slackに送信
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message
      })
    });
    
    if (response.ok) {
      alert('✅ Slackに予定を送信しました！');
      console.log('Slack通知（予定）を送信しました');
    } else {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Slack通知の送信に失敗しました:', error);
    alert(`❌ Slack通知の送信に失敗しました\n\nエラー: ${error.message}\n\nWebhook URLを確認してください。`);
  }
}

// Slack通知を送信する関数（実績）
async function sendSlackNotificationActual() {
  // Slack Webhook URLが設定されているか確認
  if (!slackWebhookUrl) {
    alert('Slack Webhook URLが設定されていません。\n\nメインメニューから「Slack連携」で設定してください。');
    return;
  }
  
  // データが空の場合
  if (stopwatches.length === 0) {
    alert('送信するタイマーデータがありません。');
    return;
  }
  
  try {
    // マークダウン形式でメッセージを作成
    let message = '*本日の実績';
    if (slackUsername) {
      message += `（${slackUsername}）`;
    }
    message += '*\n\n';
    
    // カテゴリごとにタイマーを表示
    if (categories.length > 0) {
      categories.forEach(category => {
        const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === category.id);
        if (categoryStopwatches.length > 0) {
          message += `*📁 ${category.name}*\n`;
          
          categoryStopwatches.forEach(sw => {
            const taskName = sw.taskName || 'タスク名なし';
            const actual = formatTimeForSlack(sw.elapsedSeconds);
            
            if (sw.targetSeconds && sw.targetSeconds > 0) {
              const target = formatTimeForSlack(sw.targetSeconds);
              message += `  • ${taskName} - 実績: ${actual} / 予定: ${target}\n`;
            } else {
              message += `  • ${taskName} - 実績: ${actual}\n`;
            }
          });
          
          message += '\n';
        }
      });
    }
    
    // カテゴリなしのタイマー
    const uncategorizedStopwatches = stopwatches.filter(sw => !sw.categoryId);
    if (uncategorizedStopwatches.length > 0) {
      message += '*📝 未分類*\n';
      
      uncategorizedStopwatches.forEach(sw => {
        const taskName = sw.taskName || 'タスク名なし';
        const actual = formatTimeForSlack(sw.elapsedSeconds);
        
        if (sw.targetSeconds && sw.targetSeconds > 0) {
          const target = formatTimeForSlack(sw.targetSeconds);
          message += `  • ${taskName} - 実績: ${actual} / 予定: ${target}\n`;
        } else {
          message += `  • ${taskName} - 実績: ${actual}\n`;
        }
      });
    }
    
    // Slackに送信
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message
      })
    });
    
    if (response.ok) {
      alert('✅ Slackに実績を送信しました！');
      console.log('Slack通知（実績）を送信しました');
    } else {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Slack通知の送信に失敗しました:', error);
    alert(`❌ Slack通知の送信に失敗しました\n\nエラー: ${error.message}\n\nWebhook URLを確認してください。`);
  }
}

// Slack用の時間フォーマット関数
function formatTimeForSlack(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// タイマー操作時のSlack通知
async function sendSlackActivityNotification(stopwatch, action) {
  // Webhook URLが設定されていない場合はスキップ
  if (!slackWebhookUrl) {
    return;
  }
  
  // アクションに応じて適切なフラグをチェック
  const isTimerOperation = action === 'start' || action === 'pause';
  const isTaskComplete = action === 'complete' || action === 'uncomplete';
  
  // タイマー操作の通知が無効、またはタスク完了の通知が無効の場合はスキップ
  if (isTimerOperation && !slackWebhookEnabled) {
    return;
  }
  if (isTaskComplete && !slackTaskCompleteEnabled) {
    return;
  }
  // clear, reset などその他のアクションは通知しない
  if (!isTimerOperation && !isTaskComplete) {
    return;
  }
  
  try {
    const taskName = stopwatch.taskName || 'タスク名なし';
    const currentTime = formatTimeForSlack(stopwatch.elapsedSeconds);
    let message = '';
    let icon = '';
    
    // アクションに応じたメッセージを生成
    switch (action) {
      case 'start':
        icon = '▶️';
        message = `${icon} *タイマー開始*\n`;
        message += `タスク: ${taskName}\n`;
        message += `現在時刻: ${currentTime}`;
        break;
      case 'pause':
        icon = '⏸️';
        message = `${icon} *タイマー一時停止*\n`;
        message += `タスク: ${taskName}\n`;
        message += `停止時刻: ${currentTime}`;
        break;
      case 'clear':
        icon = '🔄';
        message = `${icon} *タイマーリセット*\n`;
        message += `タスク: ${taskName}\n`;
        message += `リセット前: ${currentTime}`;
        break;
      case 'complete':
        icon = '✅';
        message = `${icon} *タスク完了*\n`;
        message += `タスク: ${taskName}\n`;
        message += `作業時間: ${currentTime}`;
        if (stopwatch.targetSeconds && stopwatch.targetSeconds > 0) {
          const target = formatTimeForSlack(stopwatch.targetSeconds);
          message += `\n予定時間: ${target}`;
        }
        break;
      case 'uncomplete':
        icon = '↩️';
        message = `${icon} *タスク完了を解除*\n`;
        message += `タスク: ${taskName}`;
        break;
      default:
        return; // 不明なアクションはスキップ
    }
    
    // ユーザ名を追加
    if (slackUsername) {
      message += `\n\n作業者: ${slackUsername}`;
    }
    
    // Slackに送信
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message
      })
    });
    
    if (response.ok) {
      console.log(`Slack通知（${action}）を送信しました:`, taskName);
    } else {
      console.error(`Slack通知の送信に失敗しました: HTTP ${response.status}`);
    }
    
  } catch (error) {
    console.error('Slack通知の送信中にエラーが発生しました:', error);
  }
}

// Slack通知ボタン（予定） - ダイアログ内
if (sendSlackNotificationScheduleBtn) {
  sendSlackNotificationScheduleBtn.addEventListener('click', () => {
    sendSlackNotificationSchedule();
  });
}

// Slack通知ボタン（実績） - ダイアログ内
if (sendSlackNotificationActualBtn) {
  sendSlackNotificationActualBtn.addEventListener('click', () => {
    sendSlackNotificationActual();
  });
}

// Slack通知ダイアログの閉じるボタン
if (slackNotificationClose) {
  slackNotificationClose.addEventListener('click', () => {
    closeSlackNotificationDialog();
  });
}

// Slack通知ダイアログの外側をクリックで閉じる
if (slackNotificationDialog) {
  slackNotificationDialog.addEventListener('click', (e) => {
    if (e.target === slackNotificationDialog) {
      closeSlackNotificationDialog();
    }
  });
}

// 設定ダイアログの閉じるボタン
if (settingsClose) {
  settingsClose.addEventListener('click', () => {
    closeSettingsDialog();
  });
}

// 設定ダイアログの外側をクリックで閉じる
if (settingsDialog) {
  settingsDialog.addEventListener('click', (e) => {
    if (e.target === settingsDialog) {
      closeSettingsDialog();
    }
  });
}

// 設定ダイアログ内のSlack連携ボタン
if (openSlackSettingsBtn) {
  openSlackSettingsBtn.addEventListener('click', () => {
    openedFromSettings = true;
    closeSettingsDialog();
    openSlackWebhookDialog();
  });
}

// 設定ダイアログ内のAI APIキー設定ボタン
if (openApiKeySettingsBtn) {
  openApiKeySettingsBtn.addEventListener('click', () => {
    openedFromSettings = true;
    closeSettingsDialog();
    openApiKeyDialog();
  });
}

// 設定ダイアログ内の保存先設定ボタン
if (openSaveLocationSettingsBtn) {
  openSaveLocationSettingsBtn.addEventListener('click', () => {
    openedFromSettings = true;
    closeSettingsDialog();
    openSaveLocationDialog();
  });
}

// 設定ダイアログ内のインポートボタン
if (openDataImportBtn) {
  openDataImportBtn.addEventListener('click', () => {
    openedFromSettings = true;
    closeSettingsDialog();
    openDataImportDialog();
  });
}

// 設定ダイアログ内のエクスポートボタン
const exportDataBtn = document.getElementById('exportDataBtn');
if (exportDataBtn) {
  exportDataBtn.addEventListener('click', async () => {
    closeSettingsDialog();
    
    try {
      // エポック秒でファイル名を生成
      const epochSeconds = Math.floor(Date.now() / 1000);
      const defaultFileName = `${epochSeconds}.json`;
      
      // データを取得
      const data = generateSaveData();
      const jsonString = JSON.stringify(data, null, 2);
      
      // ファイル保存ダイアログを表示
      const result = await ipcRenderer.invoke('save-data-file', {
        data: jsonString,
        defaultFilename: defaultFileName
      });
      
      if (result.success) {
        alert('✅ データをエクスポートしました');
      } else if (result.cancelled) {
        // キャンセルされた場合は何もしない
      } else {
        alert('❌ エクスポートに失敗しました');
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('❌ エクスポートに失敗しました');
    }
  });
}

// 保存ボタン
slackWebhookSave.addEventListener('click', () => {
  const newUrl = slackWebhookInput.value.trim();
  const newUsername = slackUsernameInput.value.trim();
  const isEnabled = slackWebhookEnabledCheckbox.checked;
  const isTaskCompleteEnabled = slackTaskCompleteEnabledCheckbox.checked;
  
  if (newUrl === '') {
    // 空文字の場合は削除
    slackWebhookUrl = null;
    localStorage.removeItem('slackWebhookUrl');
    console.log('Slack Webhook URLを削除しました');
  } else {
    // URLを保存
    slackWebhookUrl = newUrl;
    localStorage.setItem('slackWebhookUrl', slackWebhookUrl);
    console.log('Slack Webhook URLを保存しました:', slackWebhookUrl);
  }
  
  // ユーザ名を保存
  slackUsername = newUsername;
  localStorage.setItem('slackUsername', slackUsername);
  console.log('Slackユーザ名を保存しました:', slackUsername);
  
  // タイマー操作通知の有効/無効の状態を保存
  slackWebhookEnabled = isEnabled;
  localStorage.setItem('slackWebhookEnabled', slackWebhookEnabled.toString());
  console.log('Slack Webhook有効状態を保存しました:', slackWebhookEnabled);
  
  // タスク完了通知の有効/無効の状態を保存
  slackTaskCompleteEnabled = isTaskCompleteEnabled;
  localStorage.setItem('slackTaskCompleteEnabled', slackTaskCompleteEnabled.toString());
  console.log('Slackタスク完了通知有効状態を保存しました:', slackTaskCompleteEnabled);
  
  // 成功メッセージを表示（alertのみ閉じて、ダイアログは開いたまま）
  alert('✅ Slack連携設定を保存しました');
});

// キャンセルボタン
slackWebhookCancel.addEventListener('click', () => {
  closeSlackWebhookDialog();
  if (openedFromSettings) {
    openedFromSettings = false;
    openSettingsDialog();
  }
});

// オーバーレイクリックで閉じる
slackWebhookDialog.addEventListener('click', (e) => {
  if (e.target === slackWebhookDialog) {
    closeSlackWebhookDialog();
  }
});

// Enterキーで保存
slackWebhookInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    slackWebhookSave.click();
  }
});

// AI APIキー設定のイベントリスナー
if (apiKeyOk) {
  apiKeyOk.addEventListener('click', () => {
    const newApiKey = apiKeyInput.value.trim();
    
    // APIキーを保存
    apiKey = newApiKey;
    localStorage.setItem('aiApiKey', apiKey);
    console.log('AI APIキーを保存しました');
    
    // alertダイアログを表示
    alert('✅ 保存に成功しました');
  });
}

if (apiKeyCancel) {
  apiKeyCancel.addEventListener('click', () => {
    closeApiKeyDialog();
    if (openedFromSettings) {
      openedFromSettings = false;
      openSettingsDialog();
    }
  });
}

// オーバーレイクリックで閉じる
if (apiKeyDialog) {
  apiKeyDialog.addEventListener('click', (e) => {
    if (e.target === apiKeyDialog) {
      closeApiKeyDialog();
    }
  });
}

// Enterキーで保存
if (apiKeyInput) {
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      apiKeyOk.click();
    }
  });
}

// データインポート - ファイル選択ボタン
if (selectImportFileBtn) {
  selectImportFileBtn.addEventListener('click', () => {
    importFileInput.click();
  });
}

// データインポート - ファイル選択時
if (importFileInput) {
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedImportFile = file;
      selectedFileName.textContent = `選択: ${file.name}`;
      executeImportBtn.disabled = false;
    } else {
      selectedImportFile = null;
      selectedFileName.textContent = '';
      executeImportBtn.disabled = true;
    }
  });
}

// データインポート - インポート実行ボタン
if (executeImportBtn) {
  executeImportBtn.addEventListener('click', async () => {
    if (!selectedImportFile) {
      alert('ファイルが選択されていません');
      return;
    }

    // 既存データがある場合は警告
    if (stopwatches.length > 0 || categories.length > 0) {
      const confirmMessage = '既存のデータが存在します。\nインポートすると現在のデータは破棄されます。\n続行しますか？';
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          
          // データの妥当性チェック
          if (!jsonData.stopwatches || !jsonData.categories) {
            alert('❌ 無効なデータ形式です');
            return;
          }

          // 既存データをクリア
          // 全てのタイマーを停止
          stopwatches.forEach(sw => sw.stop());
          
          // 配列をクリア
          stopwatches.length = 0;
          categories.length = 0;
          
          // IDカウンターをリセット
          nextStopwatchId = 1;
          nextCategoryId = 1;
          
          // 動作中タイマーIDをクリア
          currentRunningStopwatchId = null;

          // カテゴリをインポート
          jsonData.categories.forEach(catData => {
            const newCategoryId = nextCategoryId++;
            const category = new Category(newCategoryId, catData.name);
            category.isCollapsed = catData.isCollapsed || false;
            categories.push(category);
          });

          // タイマーをインポート
          jsonData.stopwatches.forEach(swData => {
            const newStopwatchId = nextStopwatchId++;
            // カテゴリIDを調整（存在する場合）
            let newCategoryId = null;
            if (swData.categoryId !== null) {
              const oldCategoryIndex = jsonData.categories.findIndex(cat => cat.id === swData.categoryId);
              if (oldCategoryIndex !== -1) {
                newCategoryId = categories[oldCategoryIndex].id;
              }
            }

            const stopwatch = new Stopwatch(newStopwatchId, newCategoryId);
            stopwatch.elapsedSeconds = swData.elapsedSeconds || 0;
            stopwatch.taskName = swData.taskName || '';
            stopwatch.targetSeconds = swData.targetSeconds !== undefined ? swData.targetSeconds : null;
            stopwatch.isCompleted = swData.isCompleted || false;
            stopwatches.push(stopwatch);
          });

          // UIを完全にクリアして再構築
          timersContainer.innerHTML = '';
          
          // 空の状態をチェック
          if (categories.length === 0 && stopwatches.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = '「カテゴリを追加」からスタート';
            timersContainer.appendChild(emptyState);
          } else {
            // カテゴリコンテナを作成
            categories.forEach(category => {
              const categoryContainer = createCategoryContainer(category);
              timersContainer.appendChild(categoryContainer);
              
              // このカテゴリに所属するタイマーを追加
              const categoryTimers = categoryContainer.querySelector('.category-timers');
              const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === category.id);
              
              if (categoryStopwatches.length > 0) {
                // 空の状態メッセージを削除
                const emptyState = categoryTimers.querySelector('.category-empty-state');
                if (emptyState) {
                  emptyState.remove();
                }
                
                // タイマーカードを追加
                categoryStopwatches.forEach(stopwatch => {
                  const card = createStopwatchCard(stopwatch);
                  categoryTimers.appendChild(card);
                });
              }
            });
            
            // カテゴリに所属しないタイマーを作成
            stopwatches.filter(sw => sw.categoryId === null).forEach(stopwatch => {
              const card = createStopwatchCard(stopwatch);
              timersContainer.appendChild(card);
            });
          }
          
          // 合計時間を更新
          updateTotalTime();
          updateTargetTotalTime();
          updateAllCategoryTimes();

          closeDataImportDialog();
          alert('✅ データをインポートしました');
          
        } catch (error) {
          console.error('インポートエラー:', error);
          alert('❌ データの読み込みに失敗しました');
        }
      };
      reader.readAsText(selectedImportFile);
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      alert('❌ ファイルの読み込みに失敗しました');
    }
  });
}

// データインポート - 閉じるボタン
if (dataImportClose) {
  dataImportClose.addEventListener('click', () => {
    closeDataImportDialog();
    if (openedFromSettings) {
      openedFromSettings = false;
      openSettingsDialog();
    }
  });
}

// データインポート - オーバーレイクリック
if (dataImportDialog) {
  dataImportDialog.addEventListener('click', (e) => {
    if (e.target === dataImportDialog) {
      closeDataImportDialog();
      if (openedFromSettings) {
        openedFromSettings = false;
        openSettingsDialog();
      }
    }
  });
}

// Always On Topトグルのイベント
alwaysOnTopToggle.addEventListener('change', (e) => {
  alwaysOnTop = e.target.checked;
  localStorage.setItem('alwaysOnTop', alwaysOnTop.toString());
  ipcRenderer.send('set-always-on-top', alwaysOnTop);
  console.log('Always On Top設定を変更しました:', alwaysOnTop);
  e.stopPropagation();
});

// 初期化時にトグルの状態を反映
alwaysOnTopToggle.checked = alwaysOnTop;

// 透明度スライダーのイベント
opacitySlider.addEventListener('input', (e) => {
  const opacityPercent = parseInt(e.target.value);
  const opacity = opacityPercent / 100;
  
  // 透明度の値を表示
  opacityValue.textContent = `${opacityPercent}%`;
  
  // メインプロセスに透明度変更を通知
  ipcRenderer.send('set-opacity', opacity);
});

// スライダー上でクリックしてもメニューが閉じないようにする
opacitySlider.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.querySelector('.menu-item-slider').addEventListener('click', (e) => {
  e.stopPropagation();
});

// カテゴリメニューをオーバーレイ表示する関数
function showCategoryOverlayMenu(category, button, toggleEditModeCallback) {
  // 既存のオーバーレイがあれば削除
  const existingOverlay = document.querySelector('.timer-menu-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
    return;
  }

  // オーバーレイとメニューを作成
  const overlay = document.createElement('div');
  overlay.className = 'timer-menu-overlay';
  
  const menu = document.createElement('div');
  menu.className = 'timer-overlay-menu';
  
  menu.innerHTML = `
    <div class="menu-item category-edit-item">
      <span class="material-icons">edit</span>
      <span>編集</span>
    </div>
    <div class="menu-item category-add-timer-item">
      <span class="material-icons">add_circle_outline</span>
      <span>タイマーを追加</span>
    </div>
    <div class="menu-item category-delete-item">
      <span class="material-icons">delete</span>
      <span>カテゴリを削除</span>
    </div>
  `;
  
  // ボタンの位置を取得してメニューを配置
  const buttonRect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${buttonRect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - buttonRect.right}px`;
  
  overlay.appendChild(menu);
  document.body.appendChild(overlay);
  
  // アニメーション用に少し遅延
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);
  
  // メニュー項目のイベントリスナー
  const editItem = menu.querySelector('.category-edit-item');
  const addTimerItem = menu.querySelector('.category-add-timer-item');
  const deleteItem = menu.querySelector('.category-delete-item');
  
  editItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    
    // 編集モードを切り替え
    if (toggleEditModeCallback) {
      toggleEditModeCallback();
    }
  });
  
  addTimerItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    addStopwatch(category.id);
  });
  
  deleteItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    removeCategory(category.id);
  });
  
  // オーバーレイをクリックしたら閉じる
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// タイマーメニューをオーバーレイ表示する関数
function showTimerOverlayMenu(stopwatch, button, toggleEditModeCallback) {
  // 既存のオーバーレイがあれば削除
  const existingOverlay = document.querySelector('.timer-menu-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
    return;
  }

  // オーバーレイとメニューを作成
  const overlay = document.createElement('div');
  overlay.className = 'timer-menu-overlay';
  
  const menu = document.createElement('div');
  menu.className = 'timer-overlay-menu';
  
  menu.innerHTML = `
    <div class="menu-item timer-edit-item">
      <span class="material-icons">edit</span>
      <span>編集</span>
    </div>
    <div class="menu-item timer-complete-item">
      <span class="material-icons">check_circle</span>
      <span>${stopwatch.isCompleted ? '作業完了を解除' : '作業完了'}</span>
    </div>
    <div class="menu-item timer-clear-item">
      <span class="material-icons">refresh</span>
      <span>リセット</span>
    </div>
    <div class="menu-item timer-delete-item">
      <span class="material-icons">delete</span>
      <span>削除</span>
    </div>
  `;
  
  // ボタンの位置を取得してメニューを配置
  const buttonRect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${buttonRect.bottom + 5}px`;
  menu.style.right = `${window.innerWidth - buttonRect.right}px`;
  
  overlay.appendChild(menu);
  document.body.appendChild(overlay);
  
  // アニメーション用に少し遅延
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);
  
  // メニュー項目のイベントリスナー
  const editItem = menu.querySelector('.timer-edit-item');
  const completeItem = menu.querySelector('.timer-complete-item');
  const clearItem = menu.querySelector('.timer-clear-item');
  const deleteItem = menu.querySelector('.timer-delete-item');
  
  editItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    
    // 編集モードを切り替え
    if (toggleEditModeCallback) {
      toggleEditModeCallback();
    }
  });
  
  completeItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    
    const taskName = stopwatch.taskName || 'タスク名なし';
    const action = stopwatch.isCompleted ? '作業完了を解除' : '作業完了';
    const confirmMessage = `「${taskName}」を${action}しますか？`;
    
    if (confirm(confirmMessage)) {
      const wasCompleted = stopwatch.isCompleted;
      stopwatch.isCompleted = !stopwatch.isCompleted;
      
      const card = document.querySelector(`.timer-card[data-timer-id="${stopwatch.id}"]`);
      if (!card) {
        console.error('カードが見つかりません:', stopwatch.id);
        return;
      }
      
      // .toggle-btn, .start-btn, .pause-btn, .confirm-btn のいずれかを取得
      const toggleBtn = card.querySelector('.toggle-btn, .start-btn, .pause-btn, .confirm-btn');
      
      // 作業完了した場合、タイマーを停止
      if (stopwatch.isCompleted) {
        if (stopwatch.isRunning) {
          stopwatch.pause();
        }
        card.classList.add('completed');
        if (toggleBtn) {
          toggleBtn.disabled = true;
        }
        
        // Slack通知を送信（完了）
        sendSlackActivityNotification(stopwatch, 'complete');
      } else {
        card.classList.remove('completed');
        if (toggleBtn) {
          toggleBtn.disabled = false;
        }
        
        // Slack通知を送信（完了解除）
        sendSlackActivityNotification(stopwatch, 'uncomplete');
      }
      
      // ボタン表示を更新
      if (toggleBtn) {
        const icon = toggleBtn.querySelector('.material-icons');
        if (icon) {
          if (stopwatch.isRunning && !stopwatch.isPaused) {
            icon.textContent = 'pause';
            toggleBtn.title = '一時停止';
          } else {
            icon.textContent = 'play_arrow';
            toggleBtn.title = 'スタート';
          }
        }
      }
    }
  });
  
  clearItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    
    const taskName = stopwatch.taskName || 'タスク名なし';
    const timeDisplay = stopwatch.formatTime(stopwatch.elapsedSeconds);
    const confirmMessage = `「${taskName}」の時間（${timeDisplay}）をリセットしてもよろしいですか？`;
    
    if (confirm(confirmMessage)) {
      // Slack通知を送信（リセット前の時間を記録するため、clearの前に送信）
      sendSlackActivityNotification(stopwatch, 'clear');
      
      stopwatch.clear();
      const card = document.querySelector(`[data-timer-id="${stopwatch.id}"]`);
      const toggleBtn = card.querySelector('.toggle-btn');
      const icon = toggleBtn.querySelector('.material-icons');
      icon.textContent = 'play_arrow';
      toggleBtn.title = 'スタート';
      toggleBtn.classList.remove('pause-btn');
      toggleBtn.classList.add('start-btn');
    }
  });
  
  deleteItem.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    removeStopwatch(stopwatch.id);
  });
  
  // オーバーレイをクリックしたら閉じる
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

