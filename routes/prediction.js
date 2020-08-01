var dataInNex5Days = {};
var lstDataInNext5Days = {};
var serverIP = '';

const publicIp = require('public-ip');
(async function() {
  serverIP = await publicIp.v4();
})();

function  getServerIP(){
  return serverIP;
}

const request = require('request');
const { PythonShell } = require('python-shell');
function prediction(callback, ip=undefined) {
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
  var next5days;
  var firstTime = true;
  async function crawlWeather(ip=undefined){
    const publicIp = require('public-ip');
    console.log(await publicIp.v4());
    //=> '46.5.21.123'

    let isServer = undefined;
    let promise = new Promise(async (resolve, reject) => {
      isServer = (ip !== undefined || ip == '::1' || (getServerIP() == await publicIp.v4()));
      if(isServer !== undefined)
        resolve();
    });

    promise.then(async ()=>{
      let url = 'http://ip-api.com/json/' + (isServer ? await publicIp.v4() : ip);
      console.log('location request:', url);
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

          console.log('weather request:', url);
          request(url, function(err, response, body){
            // console.log(url);
            if(err) console.log(err);
            else {
              next5days = JSON.parse(body).list;
              var data5Days = {}
              // console.log(next5days);
              next5days.forEach((item, i) => {
                key = item.dt_txt.split(' ')[0];
                if(data5Days[key] == undefined){
                  data5Days[item.dt_txt.split(' ')[0]] = {
                    temp: item.main.temp,
                    humi: item.main.humidity,
                    cnt: 1,
                  }
                } else {
                  data5Days[key] = {
                    temp: (data5Days[key].temp + item.main.temp),
                    humi: (data5Days[key].humi + item.main.humidity),
                    cnt: (data5Days[key].cnt + 1),
                  }
                }
              });

              var process = new Promise((resolve, reject)=>{
                var cnt = 0;
                Object.keys(data5Days).forEach(async (key, idx, arr) => {
                  data5Days[key].temp = data5Days[key].temp/data5Days[key].cnt;
                  data5Days[key].humi = data5Days[key].humi/data5Days[key].cnt;

                  let options = {
                    mode: 'text',
                    pythonPath: 'python3',
                    // pythonOptions: ['u'],
                    // scriptPath: 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python37\\Scripts',
                    args: ['eval', data5Days[key].temp, data5Days[key].humi]
                  };

                  PythonShell.run(__dirname + '/../routes/prediction/linear.py', options, await function (err, results) {
                    if (err) console.log(err);
                    // results is an array consisting of messages collected during execution
                    console.log('results: ' + results + '--- ' + data5Days[key].temp + '=' + data5Days[key].humi, 'day: ' + key + '......' + idx, "====");
                    data5Days[key].lvl = parseInt(results[0].substr(1, results[0].length-2));
                    cnt++;
                    if(cnt == arr.length){
                      resolve();
                    }
                  });
                });
              });
              process.then(()=>{
                if(isServer) {
                  dataInNex5Days = data5Days;
                } else {
                  lstDataInNext5Days[ip] = data5Days;
                }
                if(firstTime){
                  firstTime = false;
                  callback();
                }
                else {
                  console.log('repredict');
                }
              });
            }
          });
        }
      });
    });
  }
  crawlWeather(ip);
  setInterval(crawlWeather, 1000*60*60*24, ip);
}

module.exports = { prediction, getDataInNext5Days: async (ip)=>{
  let isServer = undefined;
  let promise = new Promise(async (resolve, reject) => {
    isServer = (ip !== undefined || ip == '::1' || (getServerIP() == await publicIp.v4()));
    if(isServer !== undefined)
      resolve(isServer);
  });
  // console.log(isServer);
  let res = await promise;
  if(res)
    return dataInNex5Days;
  else
    return lstDataInNext5Days[ip];
}, };
