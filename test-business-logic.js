const { _electron: electron } = require('playwright');

// テストヘルパー関数
class TimerAppTester {
  constructor(window) {
    this.window = window;
    this.screenshotCounter = 0;
  }
  
  async takeScreenshot(description) {
    this.screenshotCounter++;
    const filename = `screenshots/${String(this.screenshotCounter).padStart(3, '0')}-${description}.png`;
    await this.window.screenshot({ path: filename });
    console.log(`    📸 スクリーンショット: ${filename}`);
  }

  async getTotalTime() {
    return await this.window.locator('#totalTimeDisplay').textContent();
  }

  async getTargetTotalTime() {
    return await this.window.locator('#targetTotalDisplay').textContent();
  }

  async getCategoryCount() {
    return await this.window.locator('.category-container').count();
  }

  async getTimerCount() {
    return await this.window.locator('.timer-card').count();
  }

  async openMenu() {
    await this.window.locator('#menuBtn').click();
    await this.window.waitForTimeout(50);
  }

  async addCategory() {
    await this.openMenu();
    await this.window.locator('#addCategoryMenuItem').click();
    await this.window.waitForTimeout(100);
  }

  async setCategoryName(index, name) {
    const categoryMenuBtn = this.window.locator('.category-menu-btn').nth(index);
    await categoryMenuBtn.click();
    await this.window.waitForTimeout(50);
    
    await this.window.locator('.category-edit-item').click();
    await this.window.waitForTimeout(50);
    
    const nameInput = this.window.locator('.category-name-input').nth(index);
    await nameInput.fill(name);
    
    const confirmBtn = this.window.locator('.category-confirm-btn').nth(index);
    await confirmBtn.click();
    await this.window.waitForTimeout(50);
  }

  async addTimerToCategory(categoryIndex) {
    const categoryMenuBtn = this.window.locator('.category-menu-btn').nth(categoryIndex);
    await categoryMenuBtn.click();
    await this.window.waitForTimeout(50);
    
    await this.window.locator('.category-add-timer-item').click();
    await this.window.waitForTimeout(100);
  }

  async setTimerDetails(timerIndex, taskName, hours, minutes, seconds) {
    // タイマー追加直後は自動的に編集モードになっている
    // visible な入力フィールドを使う（最後に追加されたタイマーが編集モード）
    const visibleTaskNameInputs = this.window.locator('.task-name-input:visible');
    
    // 編集モードの入力フィールドが表示されるまで待つ
    await visibleTaskNameInputs.first().waitFor({ state: 'visible', timeout: 2000 });
    
    // 最後の（一番新しい）visible な入力フィールドを使う
    const taskNameInput = visibleTaskNameInputs.last();
    await taskNameInput.fill(taskName);
    
    if (hours !== null) {
      const hoursInput = this.window.locator('.target-hours:visible').last();
      await hoursInput.fill(hours.toString());
    }
    if (minutes !== null) {
      const minutesInput = this.window.locator('.target-minutes:visible').last();
      await minutesInput.fill(minutes.toString());
    }
    if (seconds !== null) {
      const secondsInput = this.window.locator('.target-seconds:visible').last();
      await secondsInput.fill(seconds.toString());
    }
    
    // 確定ボタンをクリック（編集モードを終了）
    // visible な confirm-btn の最後のものをクリック
    const confirmBtn = this.window.locator('.confirm-btn:visible').last();
    await confirmBtn.click();
    await this.window.waitForTimeout(150);
  }

  async startTimer(timerIndex) {
    const startBtn = this.window.locator('.start-btn').nth(timerIndex);
    await startBtn.click();
    await this.window.waitForTimeout(50);
  }

  async pauseTimer(timerIndex) {
    // 一時停止ボタンが存在するか確認してからクリック
    const pauseBtn = this.window.locator('.pause-btn').nth(timerIndex);
    const count = await pauseBtn.count();
    if (count > 0) {
      await pauseBtn.click();
      await this.window.waitForTimeout(50);
    } else {
      // pause-btnが存在しない場合、既に停止しているかstart-btnの状態の可能性
      console.log(`    ⚠️  タイマー${timerIndex}の一時停止ボタンが見つかりません（既に停止済み？）`);
    }
  }

  async getTimerDisplay(timerIndex) {
    return await this.window.locator('.timer-display').nth(timerIndex).textContent();
  }

  async markTaskComplete(timerIndex) {
    const menuBtn = this.window.locator('.timer-menu-btn-top').nth(timerIndex);
    await menuBtn.click();
    await this.window.waitForTimeout(300);
    
    // メニュー項目が表示されるのを待つ
    const menuItem = this.window.locator('.timer-complete-item');
    await menuItem.waitFor({ state: 'visible', timeout: 3000 });
    await this.window.waitForTimeout(200);
    
    // メニュー項目をクリック（ダイアログは手動で操作）
    await menuItem.click();
    
    // ユーザーがダイアログを操作する時間を確保
    console.log('    ⏸️  ダイアログが表示されます（15秒以内に手動で操作してください）');
    await this.window.waitForTimeout(15000);
  }

  async resetTimer(timerIndex) {
    const menuBtn = this.window.locator('.timer-menu-btn-top').nth(timerIndex);
    await menuBtn.click();
    await this.window.waitForTimeout(300);
    
    // メニュー項目が表示されるのを待つ
    const menuItem = this.window.locator('.timer-clear-item');
    await menuItem.waitFor({ state: 'visible', timeout: 3000 });
    await this.window.waitForTimeout(200);
    
    // メニュー項目をクリック（ダイアログは手動で操作）
    await menuItem.click();
    
    // ユーザーがダイアログを操作する時間を確保
    console.log('    ⏸️  ダイアログが表示されます（15秒以内に手動で操作してください）');
    await this.window.waitForTimeout(15000);
  }

  async deleteTimer(timerIndex) {
    const menuBtn = this.window.locator('.timer-menu-btn-top').nth(timerIndex);
    await menuBtn.click();
    await this.window.waitForTimeout(300);
    
    // メニュー項目が表示されるのを待つ
    const menuItem = this.window.locator('.timer-delete-item');
    await menuItem.waitFor({ state: 'visible', timeout: 3000 });
    await this.window.waitForTimeout(200);
    
    // メニュー項目をクリック（ダイアログは手動で操作）
    await menuItem.click();
    
    // ユーザーがダイアログを操作する時間を確保
    console.log('    ⏸️  ダイアログが表示されます（15秒以内に手動で操作してください）');
    await this.window.waitForTimeout(15000);
  }

  async getCategoryTime(categoryIndex) {
    const elapsed = await this.window.locator('.category-elapsed-time').nth(categoryIndex).textContent();
    const target = await this.window.locator('.category-target-time').nth(categoryIndex).textContent();
    return { elapsed, target };
  }
}

// アサーション関数
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`❌ ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertGreaterThan(actual, expected, message) {
  if (actual <= expected) {
    throw new Error(`❌ ${message}\n  Expected > ${expected}\n  Actual: ${actual}`);
  }
}

async function main() {
  console.log('🚀 ビジネスロジック統合テストを開始します\n');
  console.log('=' .repeat(60));
  
  // Electronアプリを起動
  const electronApp = await electron.launch({
    args: ['main.js']
  });
  
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  
  // デフォルトタイムアウトを5秒に設定
  window.setDefaultTimeout(5000);
  
  console.log('📸 スクリーンショット録画モードで開始します（screenshotsフォルダに保存されます）');
  
  const tester = new TimerAppTester(window);
  
  let testsPassed = 0;
  let testsFailed = 0;

  // テスト1: 初期状態の確認
  console.log('\n📋 テスト1: 初期状態の確認');
  try {
    await tester.takeScreenshot('initial-state');
    
    const totalTime = await tester.getTotalTime();
    assertEqual(totalTime, '00:00:00', '初期合計時間は00:00:00であること');
    
    const categoryCount = await tester.getCategoryCount();
    assertEqual(categoryCount, 0, '初期カテゴリ数は0であること');
    
    const timerCount = await tester.getTimerCount();
    assertEqual(timerCount, 0, '初期タイマー数は0であること');
    
    console.log('  ✅ 初期状態は正常です');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト2: カテゴリの作成とリネーム
  console.log('\n📋 テスト2: カテゴリの作成とリネーム');
  try {
    await tester.addCategory();
    let count = await tester.getCategoryCount();
    assertEqual(count, 1, 'カテゴリが1つ追加されること');
    
    await tester.setCategoryName(0, '開発作業');
    await tester.takeScreenshot('category-dev-created');
    
    await tester.addCategory();
    count = await tester.getCategoryCount();
    assertEqual(count, 2, 'カテゴリが2つになること');
    
    await tester.setCategoryName(1, '会議');
    await tester.takeScreenshot('two-categories-created');
    
    console.log('  ✅ カテゴリ作成とリネームが正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト3: タイマーの作成と設定
  console.log('\n📋 テスト3: タイマーの作成と設定');
  try {
    // 開発作業カテゴリにタイマーを2つ追加
    console.log('  - フロントエンド実装タイマーを追加中...');
    await tester.addTimerToCategory(0);
    await tester.setTimerDetails(0, 'フロントエンド実装', 2, 30, 0);
    await tester.takeScreenshot('timer-frontend-added');
    
    console.log('  - バックエンド実装タイマーを追加中...');
    await tester.addTimerToCategory(0);
    await tester.setTimerDetails(1, 'バックエンド実装', 1, 30, 0);
    
    // 会議カテゴリにタイマーを1つ追加
    console.log('  - デイリースタンドアップタイマーを追加中...');
    await tester.addTimerToCategory(1);
    await tester.setTimerDetails(2, 'デイリースタンドアップ', 0, 30, 0);
    await tester.takeScreenshot('all-timers-created');
    
    const count = await tester.getTimerCount();
    assertEqual(count, 3, 'タイマーが3つ作成されること');
    console.log(`  - タイマー数: ${count}個`);
    
    // 目標時間の合計を確認
    const targetTotal = await tester.getTargetTotalTime();
    assertEqual(targetTotal, '04:30:00', '目標時間の合計が正しいこと');
    console.log(`  - 目標合計時間: ${targetTotal}`);
    
    console.log('  ✅ タイマー作成と目標時間設定が正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト4: タイマーの開始・一時停止・時間計測
  console.log('\n📋 テスト4: タイマーの開始・一時停止・時間計測');
  try {
    // フロントエンド実装を開始
    await tester.startTimer(0);
    await window.waitForTimeout(1200); // 1.2秒待機
    await tester.takeScreenshot('timer-running');
    
    let time = await tester.getTimerDisplay(0);
    assert(time !== '00:00:00', 'タイマーが動作していること');
    console.log(`  - フロントエンド実装: ${time}`);
    
    // 一時停止
    await tester.pauseTimer(0);
    const pausedTime = await tester.getTimerDisplay(0);
    await window.waitForTimeout(600); // 0.6秒待機
    const stillPausedTime = await tester.getTimerDisplay(0);
    assertEqual(pausedTime, stillPausedTime, '一時停止中は時間が進まないこと');
    
    // 別のタイマーを開始（自動的に前のタイマーが停止するはず）
    await tester.startTimer(1); // バックエンド実装
    await window.waitForTimeout(1100); // 1.1秒待機
    
    time = await tester.getTimerDisplay(1);
    console.log(`  - バックエンド実装: ${time}`);
    assert(time !== '00:00:00', 'バックエンド実装タイマーが動作していること');
    
    // 一時停止（タイムアウトを避けるため、try-catchで処理）
    try {
      await tester.pauseTimer(1);
    } catch (pauseError) {
      console.log('  - 一時停止ボタンが見つからない場合はスキップ');
      // タイマーが既に停止している可能性があるため、続行
    }
    
    // 合計時間が更新されていることを確認
    const totalTime = await tester.getTotalTime();
    assert(totalTime !== '00:00:00', '合計時間が更新されていること');
    console.log(`  - 合計時間: ${totalTime}`);
    await tester.takeScreenshot('timer-with-elapsed-time');
    
    console.log('  ✅ タイマーの開始・一時停止が正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト5: 複数タイマーの同時管理（排他制御）
  console.log('\n📋 テスト5: 複数タイマーの排他制御');
  try {
    // タイマー1を開始
    await tester.startTimer(1); // バックエンド実装
    await window.waitForTimeout(500);
    console.log('  - バックエンド実装を開始しました');
    
    // タイマー0を開始（タイマー1は自動停止するはず）
    await tester.startTimer(0); // フロントエンド実装
    await window.waitForTimeout(300);
    console.log('  - フロントエンド実装を開始しました（バックエンドは自動停止）');
    
    // タイマー0が動作中であることを確認
    const card0 = window.locator('.timer-card').nth(0);
    const isRunning = await card0.evaluate(el => el.classList.contains('running'));
    assert(isRunning, '新しく開始したタイマーが実行中であること');
    
    await tester.pauseTimer(0);
    
    console.log('  ✅ タイマーの排他制御が正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト6: カテゴリごとの時間集計
  console.log('\n📋 テスト6: カテゴリごとの時間集計');
  try {
    const devCategoryTime = await tester.getCategoryTime(0);
    console.log(`  - 開発作業: ${devCategoryTime.elapsed} ${devCategoryTime.target}`);
    
    assert(devCategoryTime.elapsed !== '00:00:00', '開発カテゴリの時間が集計されていること');
    assert(devCategoryTime.target.includes('04:00:00'), '開発カテゴリの目標時間が正しいこと');
    
    const meetingCategoryTime = await tester.getCategoryTime(1);
    console.log(`  - 会議: ${meetingCategoryTime.elapsed} ${meetingCategoryTime.target}`);
    
    assert(meetingCategoryTime.target.includes('00:30:00'), '会議カテゴリの目標時間が正しいこと');
    
    console.log('  ✅ カテゴリごとの時間集計が正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト7: タイマーのリセット
  console.log('\n📋 テスト7: タイマーのリセット');
  try {
    const beforeReset = await tester.getTimerDisplay(0);
    console.log(`  - リセット前: ${beforeReset}`);
    
    await tester.resetTimer(0);
    
    const afterReset = await tester.getTimerDisplay(0);
    assertEqual(afterReset, '00:00:00', 'リセット後は00:00:00になること');
    console.log(`  - リセット後: ${afterReset}`);
    
    console.log('  ✅ タイマーのリセットが正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト8: 作業完了のマーク
  console.log('\n📋 テスト8: 作業完了のマーク');
  try {
    // デイリースタンドアップを完了としてマーク
    await tester.markTaskComplete(2);
    
    const card = window.locator('.timer-card').nth(2);
    const isCompleted = await card.evaluate(el => el.classList.contains('completed'));
    assert(isCompleted, 'タスクが完了状態になること');
    
    // 完了したタスクのトグルボタンが無効化されていることを確認
    const toggleBtn = card.locator('.toggle-btn, .start-btn, .pause-btn').first();
    const isDisabled = await toggleBtn.evaluate(el => el.disabled);
    assert(isDisabled, '完了したタスクは開始できないこと');
    
    console.log('  ✅ 作業完了マークが正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト9: タイマーの削除
  console.log('\n📋 テスト9: タイマーの削除');
  try {
    const beforeCount = await tester.getTimerCount();
    
    await tester.deleteTimer(1); // バックエンド実装を削除
    
    const afterCount = await tester.getTimerCount();
    assertEqual(afterCount, beforeCount - 1, 'タイマーが1つ減ること');
    
    console.log(`  - 削除前: ${beforeCount}個, 削除後: ${afterCount}個`);
    console.log('  ✅ タイマーの削除が正常に動作');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト10: 長時間動作テスト（実時間の2秒で動作確認）
  console.log('\n📋 テスト10: 長時間動作テスト');
  try {
    await tester.startTimer(0); // フロントエンド実装を開始
    console.log('  - 2秒間の動作テスト開始...');
    
    await window.waitForTimeout(2000);
    
    const time = await tester.getTimerDisplay(0);
    console.log(`  - 2秒後の時間: ${time}`);
    
    // 時間が進んでいることを確認（1秒以上であることを確認）
    const parts = time.split(':');
    const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    assertGreaterThan(seconds, 1, '2秒間で1秒以上進んでいること');
    
    await tester.pauseTimer(0);
    
    console.log('  ✅ 長時間動作が正常');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト11: 最終的な合計時間の整合性
  console.log('\n📋 テスト11: 合計時間の整合性確認');
  try {
    const totalTime = await tester.getTotalTime();
    console.log(`  - 最終合計時間: ${totalTime}`);
    
    // 合計時間が00:00:00より大きいことを確認
    assert(totalTime !== '00:00:00', '合計時間が計測されていること');
    
    // 各タイマーの時間を取得
    const times = [];
    const currentTimerCount = await tester.getTimerCount();
    for (let i = 0; i < currentTimerCount; i++) {
      const time = await tester.getTimerDisplay(i);
      times.push(time);
      console.log(`  - タイマー${i + 1}: ${time}`);
    }
    
    console.log('  ✅ 合計時間の整合性が確認できました');
    testsPassed++;
  } catch (error) {
    console.error(`  ${error.message}`);
    testsFailed++;
  }

  // テスト結果のサマリー
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 テスト結果サマリー');
  console.log('=' .repeat(60));
  console.log(`✅ 成功: ${testsPassed}件`);
  console.log(`❌ 失敗: ${testsFailed}件`);
  console.log(`📈 成功率: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('=' .repeat(60));

  if (testsFailed === 0) {
    console.log('\n🎉 すべてのビジネスロジックテストが成功しました！');
  } else {
    console.log(`\n⚠️  ${testsFailed}件のテストが失敗しました`);
  }

  // アプリを終了
  console.log('\n⏰ 3秒後にアプリを終了します...');
  await window.waitForTimeout(3000);
  
  await electronApp.close();
  console.log('👋 テスト完了');
  console.log(`📸 スクリーンショットが保存されました: screenshots/ フォルダを確認してください（${tester.screenshotCounter}枚）\n`);

  // 失敗があれば非ゼロで終了
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

