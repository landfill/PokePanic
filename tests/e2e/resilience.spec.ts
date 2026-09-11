import{test,expect}from'@playwright/test';
test.use({locale:'ko-KR'});
test.beforeEach(async({page})=>{await page.clock.install({time:0});await page.clock.pauseAt(0);});

test('denied storage keeps a playable memory profile and retry',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.getByText('기록을 이 세션의 메모리에 보관합니다.')).toBeVisible();
 await page.getByRole('button',{name:'쇼 시작'}).click({force:true});
 await page.clock.fastForward(660);await page.getByRole('button',{name:'파워 결정',exact:true}).click({force:true});
 await page.getByRole('button',{name:'각도 결정 · 발사',exact:true}).click({force:true});await page.clock.fastForward(6000);
 await page.getByRole('button',{name:'다시 도전',exact:true}).click({force:true});
 await expect(page.locator('#app')).toHaveAttribute('data-phase','POWER');expect(errors).toEqual([]);
});

test('a future saved schema is never overwritten by preparation or settings',async({page})=>{
 const future='{"schemaVersion":99,"unknownData":"keep-me"}';
 await page.addInitScript(value=>localStorage.setItem('poke-and-panic.profile.v1',value),future);
 await page.goto('/');await expect(page.getByText('더 새로운 버전의 저장 기록을 보존했습니다.')).toBeVisible();
 await page.getByRole('button',{name:'쇼 시작'}).click({force:true});
 await page.getByRole('button',{name:'소리 끄기'}).click({force:true});
 expect(await page.evaluate(()=>localStorage.getItem('poke-and-panic.profile.v1'))).toBe(future);
});

test('lost WebGL context retries resources without changing locked power or firing',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'쇼 시작'}).click({force:true});
 await page.clock.fastForward(660);await page.getByRole('button',{name:'파워 결정',exact:true}).click({force:true});
 await expect(page.locator('#app')).toHaveAttribute('data-phase','AIM');
 const supported=await page.locator('canvas').evaluate(canvas=>{
  const extension=(canvas as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');
  if(!extension)return false;extension.loseContext();return true;
 });
 expect(supported).toBe(true);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','ERROR');
 await page.getByRole('button',{name:'다시 시도',exact:true}).click({force:true});
 await expect(page.locator('#app')).toHaveAttribute('data-phase','AIM');
 await expect(page.locator('.pp-helper')).toContainText('정중앙 최대 570점');
 await page.clock.fastForward(16);
 await expect(page.locator('#app')).toHaveAttribute('data-phase','AIM');
});
