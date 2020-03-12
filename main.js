const { createWorker, createScheduler } = require('tesseract.js');
const fs = require('fs');
let imgpath = "./resources/ScreenShot_20-03-03_20-39-43-000.jpg";
process.env.TESSDATA_PREFIX = './tessdata/';
const workers = new Array(6);
const scheduler = createScheduler();
let rectangles = new Array(12);
let output = '';
(async () => {
  for (let index = 0; index < 6; index++) {
    workers[index] = createWorker({
      logger: m => console.log(m), // Add logger here
    });;
    await workers[index].load();
    await workers[index].loadLanguage('eng');
    await workers[index].initialize('eng');
    scheduler.addWorker(workers[index]);
  }
  for (let index = 0; index < 12; index++) {
    rectangles[index] = { left: 800, top: 324 + (50 * index), width: 960, height: 50 };
  }
  const results = await Promise.all(rectangles.map((rectangle) => (
    scheduler.addJob('recognize', imgpath, { rectangle })
  )));
  console.log(results);
  console.log(results.toString());
  fs.writeFile('./output.txt', results.map(r => r.data.text).join('\n'), (err) => {
    if (err) throw err;
    console.log('Success!');
  });
  for (let index = 0; index < 6; index++) {
    await workers[index].terminate();
  }
})();

