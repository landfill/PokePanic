import { expect, test } from '@playwright/test';

test.use({locale:'ko-KR'});

test('M1 product starts, uses two inputs, reveals the same actor and retries after failure', async ({ page }, testInfo) => {
  await page.clock.install({time:0});
  await page.clock.pauseAt(0);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>errors.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'똥침각',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'쇼 시작'}).click({force:true});
  await expect(page.getByRole('button',{name:'파워 결정',exact:true})).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.clock.fastForward(660);
  await page.screenshot({path:`artifacts/local/product-power-${testInfo.project.name}.png`});
  await page.getByRole('button',{name:'파워 결정',exact:true}).click({force:true});
  await expect(page.getByRole('button',{name:'각도 결정 · 발사',exact:true})).toBeVisible();
  // Fire immediately near -60 degrees: clearly outside the safety pad.
  await page.getByRole('button',{name:'각도 결정 · 발사',exact:true}).click({force:true});
  await expect(page.locator('#app')).toHaveAttribute('data-phase','SCENE');
  await page.clock.fastForward(6000);
  await expect(page.getByRole('button',{name:'다시 도전',exact:true})).toBeVisible({timeout:10000});
  await page.screenshot({path:`artifacts/local/product-result-${testInfo.project.name}.png`});
  const retryRect=await page.getByRole('button',{name:'다시 도전',exact:true}).boundingBox();
  expect(retryRect!.y+retryRect!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.getByRole('button',{name:'다시 도전',exact:true}).click({force:true});
  await expect(page.locator('#app')).toHaveAttribute('data-phase','POWER');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('settings and language do not fire and resume is explicit',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'쇼 시작'}).click();
  await page.getByRole('button',{name:'설정 열기'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','PAUSED');
  await page.getByRole('button',{name:'닫기'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','PAUSED');
  await page.getByRole('button',{name:'이어하기',exact:true}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','POWER');
  await page.getByRole('button',{name:'English로 전환'}).click();
  await expect(page.getByRole('button',{name:'Lock power',exact:true})).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','POWER');
});

test('minimized discovery stays unseen until collection playback; preview preserves run and bag',async({page})=>{
  await page.clock.install({time:0});
  await page.clock.pauseAt(0);
  await page.addInitScript(()=>localStorage.setItem('poke-and-panic.profile.v1',JSON.stringify({
    schemaVersion:1,bestScore:0,bestStreak:0,discoveredCharacterIds:[],unlockedEndingIds:[],seenEndingIds:[],
    bag:{order:['iron','complaint','manager','action','yoga','guard','walker','referee'],cursor:0,previousCharacterId:null,characterRngState:1},
    settings:{locale:'ko',muted:true,reducedMotion:true,screenShake:false,minimizeScenes:true},
  })));
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('poke-and-panic.profile.v1')!));
  await page.goto('/');await page.getByRole('button',{name:'쇼 시작'}).click({force:true});
  await page.getByRole('button',{name:'파워 결정',exact:true}).click({force:true});
  await page.getByRole('button',{name:'각도 결정 · 발사',exact:true}).click({force:true});
  await page.clock.fastForward(2000);
  await expect(page.getByRole('button',{name:'다시 도전',exact:true})).toBeVisible({timeout:10000});
  const before=await stored();
  expect(before.discoveredCharacterIds).toEqual(['iron']);
  expect(before.unlockedEndingIds).toEqual(['awkward-miss']);
  expect(before.seenEndingIds).toEqual([]);
  await page.getByRole('button',{name:'도감 열기'}).click({force:true});
  const dialog=page.locator('.pp-collection');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('민원 여왕',{exact:true})).toHaveCount(0);
  await expect(dialog.getByText('옷깃 잡힌 날',{exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'철근 씨와 다시 보기'}).click({force:true});
  await expect(dialog).not.toBeVisible();
  await page.clock.fastForward(6100);
  await expect(dialog).toBeVisible({timeout:10000});
  const after=await stored();
  expect(after.seenEndingIds).toEqual(['awkward-miss']);
  expect(after.bag).toEqual(before.bag);
  expect(after.bestScore).toBe(before.bestScore);
  expect(after.unlockedEndingIds).toEqual(before.unlockedEndingIds);
  await dialog.getByRole('button',{name:'도감 닫기'}).click({force:true});
  await expect(page.locator('#app')).toHaveAttribute('data-phase','PAUSED');
  await page.getByRole('button',{name:'이어하기',exact:true}).click({force:true});
  await expect(page.getByRole('button',{name:'다시 도전',exact:true})).toBeVisible();
});

test('keyboard start and modal close do not become an extra shot; pause holds AIM',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'쇼 시작'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-phase','POWER');
  await page.keyboard.press('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-phase','AIM');
  await page.getByRole('button',{name:'도감 열기'}).click();
  await page.locator('.pp-collection').getByRole('button',{name:'도감 닫기'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','PAUSED');
  await page.getByRole('button',{name:'이어하기',exact:true}).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-phase','AIM');
});

test('pausing and resuming a collection preview cannot advance a live AIM clock',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('poke-and-panic.profile.v1',JSON.stringify({
    schemaVersion:1,bestScore:0,bestStreak:0,discoveredCharacterIds:['iron'],unlockedEndingIds:['awkward-miss'],seenEndingIds:['awkward-miss'],
    bag:{order:['iron','complaint','manager','action','yoga','guard','walker','referee'],cursor:0,previousCharacterId:null,characterRngState:1},
    settings:{locale:'ko',muted:true,reducedMotion:true,screenShake:false,minimizeScenes:false},
  })));
  await page.goto('/');await page.getByRole('button',{name:'쇼 시작'}).click();
  await page.getByRole('button',{name:'파워 결정',exact:true}).click();
  await page.getByRole('button',{name:'도감 열기'}).click();
  const frozenAngle=await page.locator('.pp-fan').getAttribute('aria-label');
  const dialog=page.locator('.pp-collection');
  await dialog.getByRole('button',{name:'철근 씨와 다시 보기'}).click();
  await page.getByRole('button',{name:'설정 열기'}).click();
  await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'이어하기',exact:true}).click();
  await page.getByRole('button',{name:'도감으로',exact:true}).click();
  await dialog.getByRole('button',{name:'도감 닫기'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','PAUSED');
  await expect(page.locator('.pp-fan')).toHaveAttribute('aria-label',frozenAngle!);
});
