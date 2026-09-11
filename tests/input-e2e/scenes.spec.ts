import{test,expect}from'@playwright/test';
const cases=[
 ['iron','representative-iron',570],['complaint','representative-complaint',570],
 ['iron','false-relief',699],['complaint','false-relief',699],
 ['iron','self-own',0],['complaint','awkward-miss',0],['complaint','fake-forgiveness',570],
 ['iron','success',1000],['complaint','success',1000],
]as const;
test.describe('deterministic rendered scene evidence',()=>{
 test.use({viewport:{width:360,height:600},deviceScaleFactor:1});
 for(const[actor,ending,score]of cases)test(`${actor} ${ending}`,async({page},info)=>{
  test.skip(info.project.name!=='desktop-input','Same 360px fixture captured once; product mobile interaction has separate tests.');
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/scene.html');
  await page.evaluate(({actor,ending})=>window.sceneFixture.prepare(actor,ending),{actor,ending});
  for(const time of [0,1900,3200,4400,5000,5900]){
   await page.evaluate(time=>window.sceneFixture.draw(time),time);
   const details=JSON.parse((await page.locator('#details').textContent())!);
   expect(details.score).toBe(score);
   await info.attach(`metrics-${time}`,{body:JSON.stringify(details),contentType:'application/json'});
   await page.locator('#scene').screenshot({path:`artifacts/local/scenes/${actor}-${ending}-${time}.png`});
  }
  expect(errors).toEqual([]);
 });
});

test('700-point center contact uses the success scene',async({page},info)=>{
 test.skip(info.project.name!=='desktop-input','One 360px visual capture for the exact score boundary.');
 await page.setViewportSize({width:360,height:600});await page.goto('/scene.html');
 await page.evaluate(()=>{const power=100*((700-.5)/1000)**(1/1.1)+.000001;window.sceneFixture.prepare('iron','success',power,0);window.sceneFixture.draw(3900);});
 const details=JSON.parse((await page.locator('#details').textContent())!);expect(details.score).toBe(700);expect(details.failureType).toBeNull();
 await page.locator('#scene').screenshot({path:'artifacts/local/scenes/iron-success-700.png'});
});
