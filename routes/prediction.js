var dataInNex5Days = {};
function getDataInNext5Days(){
  return dataInNex5Days;
}

const request = require('request');
const { PythonShell } = require('python-shell');
function prediction(callback) {
  // let options = {
  //   mode: 'text',
  //   pythonPath: 'python3',
  //   // pythonOptions: ['u'],
  //   // scriptPath: 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python37\\Scripts',
  //   args: ['train']
  // };
  // console.log('training!');
  // PythonShell.run(__dirname + '/../routes/prediction/linear.py', options, function (err, results) {
  //   if (err) throw err;
  //   // results is an array consisting of messages collected during execution
  //   console.log('results: %j', results);
  //
  // });
  const publicIp = require('public-ip');
  var next5days;
  var firstTime = true;
  async function crawlWeather(){
    // console.log(await publicIp.v4());
    //=> '46.5.21.123'
    let url = 'http://ip-api.com/json/' + await publicIp.v4();
    request(await url, function(err, response, body){
      if(err) console.log(err);
      else {
        let info = JSON.parse(body), city="Ho Chi Minh City";
        // console.log(info);
        if(info.status == 'success' && info.city){
          city = info.city;
        }

        let api = '9559a25fcb2825e55c5af3b867369b67';
        // http://api.openweathermap.org/data/2.5/forecast?q=Ho%20Chi%20Minh%20City&mode=json&appid=9559a25fcb2825e55c5af3b867369b67
        let url = 'http://api.openweathermap.org/data/2.5/forecast?q=' + city + '&units=metric&mode=json&appid=' + api;

        request(url, function(err, response, body){
          // console.log(url);
          if(err) console.log(err);
          else {
            next5days = JSON.parse(body).list;
            // console.log(next5days);
            next5days.forEach((item, i) => {
              key = item.dt_txt.split(' ')[0];
              if(dataInNex5Days[key] == undefined){
                dataInNex5Days[item.dt_txt.split(' ')[0]] = {
                  temp: item.main.temp,
                  humi: item.main.humidity,
                  cnt: 1,
                }
              } else {
                dataInNex5Days[key] = {
                  temp: (dataInNex5Days[key].temp + item.main.temp),
                  humi: (dataInNex5Days[key].humi + item.main.humidity),
                  cnt: (dataInNex5Days[key].cnt + 1),
                }
              }
            });

            var process = new Promise((resolve, reject)=>{
              var cnt = 0;
              Object.keys(dataInNex5Days).forEach(async (key, idx, arr) => {
                dataInNex5Days[key].temp = dataInNex5Days[key].temp/dataInNex5Days[key].cnt;
                dataInNex5Days[key].humi = dataInNex5Days[key].humi/dataInNex5Days[key].cnt;

                let options = {
                  mode: 'text',
                  pythonPath: 'python3',
                  // pythonOptions: ['u'],
                  // scriptPath: 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python37\\Scripts',
                  args: ['eval', dataInNex5Days[key].temp, dataInNex5Days[key].humi]
                };

                PythonShell.run(__dirname + '/../routes/prediction/linear.py', options, await function (err, results) {
                  if (err) console.log(err);
                  // results is an array consisting of messages collected during execution
                  console.log('results: %j ' + '--- ' + dataInNex5Days[key].temp + '=' + dataInNex5Days[key].humi  + '-' + idx + '-' + arr, results);
                  dataInNex5Days[key].predLvl = results;
                  cnt++;
                  if(cnt == arr.length){
                    resolve();
                  }
                });
              });
            });
            process.then(()=>{
              if(firstTime){
                firstTime = false;
                callback();
              }
              else
                console.log('repredict');
            });
          }
        });
      }
    });
  }
  crawlWeather();
  setInterval(crawlWeather, 1000*60*60*24);
}

module.exports = { prediction, getDataInNext5Days };
