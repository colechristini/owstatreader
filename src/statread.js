// @flow
const { createWorker, createScheduler } = require('tesseract.js');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const winston = require('winston');
process.env.TESSDATA_PREFIX = '../tessdata/';
const numberOfWorkers = 6;
const workers = new Array(6);
const scheduler = createScheduler();
let rectangles = new Array(12);
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '../logs/combined.log' })
  ]
});

exports.extractKeyframes = extractKeyframes;

async function extractKeyframes(video: Buffer, timestamps: Array<string>) {
  let output: Array<string> = new Array(timestamps.length);
  for (let i = 0; i < timestamps.length; i++) {
    timestamps[i] =  (parseInt( timestamps[i].split(':')[0]) * 60 + parseInt(timestamps[i].split(':')[1])).toString();  //Convert M:SS string to seconds
    let frame;
    let ffstream = ffmpeg(bufferToStream(video))
      .setStartTime(timestamps[i])
      .frames(1)
      .format('png')
      .size('?x1080') //rescale to 1920x1080
      .withInputOption('-r')
      .pipe();
    let buff = [];
    ffstream.on('data', function (chunk) {  //For each chunk of the output image push to the array
      buff.push(chunk);
    });
    ffstream.on('finished', async function () { //Once each frame is extracted, it's processed and added to the array
      frame = Buffer.concat(buff);
      output[i] = await detectStats(frame);
    });
  }
  return output;
}

async function detectStats(image: Buffer) {//Set up agents for text recognition via Tesseract.js
  for (let index = 0; index < numberOfWorkers; index++) {
    workers[index] = createWorker({
      logger: m => logger.info(m), //Add logger here
    });
    await workers[index].load();
    await workers[index].loadLanguage('eng');
    await workers[index].initialize('eng');
    scheduler.addWorker(workers[index]);  //Add worker to scheduler to enable parallel recognition of multiple lines
  }
  for (let index = 0; index < 6; index++) {  //Set up the rectangles for the lines of text(Multiple lines will negatively impact recognition quality)
    rectangles[index] = { left: 800, top: 324 + (50 * index), width: 960, height: 50 };  //Recognition areas for blue team/team on left
    rectangles[index+6] = { left: 800, top: 324 + (50 * index), width: 960, height: 50 };  //Recognition areas for red team/team on right
  }
  const results = await Promise.all(rectangles.map((rectangle) => (  //Add all rectangles as new jobs to the scheduler
    scheduler.addJob('recognize', image, { rectangle })
  )));
  for (let index = 0; index < numberOfWorkers; index++) { //Close all active workers
    await workers[index].terminate();
  }
  return results.map(r => r.data.text).join('‍').replace(/-/g, ', '); //Convert format to csv and exit
}

function bufferToStream(binary: Buffer) {  //Converts the buffer to a stream so that it can be used as the source for the frame extraction
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    }
  });
  return readableInstanceStream;
}