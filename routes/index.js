const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const session = require("express-session");
const moment = require('moment');

// connect db
var db;
let initDbConection = function(callback){
  const MongoClient = require('mongodb').MongoClient;
  const uri = "mongodb+srv://dbMqttTest:PNThoai9x@cluster0-u7lvh.mongodb.net/test?retryWrites=true&w=majority";
  const mongoOptions = {
    poolSize: 1000,
    promiseLibrary: global.Promise,
    useUnifiedTopology: true
  };

  MongoClient.connect(uri, mongoOptions, function(err, client) {
    if(err) throw err;
    db = client.db('dbMqttTest');
    callback();
  });
};

const mqtt = require('mqtt');
let mqttClient = mqtt.connect('mqtt:52.163.220.103:1883');
mqttClient.on('connect', function () {
  mqttClient.subscribe('water', function (err, granted) {
    console.log('connected');
    if (!err) {
      console.log(granted);
    }
  });
});

let router = express.Router();

router.get(['/', '/home'], function(req, res) {
  db.collection('tree').find({}).toArray(function(err, treeLst){

    if(err) throw err;
    console.log('req from:' + req.url);
    let trees = [];
    treeLst.forEach((tree) => {
      trees.push(tree.name);
    });
    console.log(trees);
    res.render('../views/index', {data: trees});
  });
});

mqttClient.on('message', function (topic, message) {
  // message is Buffer
  console.log(topic);
  console.log(message.toString());
});

router.post('/operation/filterTreeList', function(req, res, next) {
  console.log('req from:' + req.url);
  let temperatureMinValue = req.body.data.TemperatureMinValue;
  let temperatureMaxValue = req.body.data.TemperatureMaxValue;
  let moistureMinValue = req.body.data.MoistureMinValue;
  let moistureMaxValue = req.body.data.MoistureMaxValue;
  let humidityMinValue = req.body.data.HumidityMinValue;
  let humidityMaxValue = req.body.data.HumidityMaxValue;

  if (temperatureMinValue == '')
    temperatureMinValue = Number.MIN_SAFE_INTEGER;
  if (temperatureMaxValue == '')
    temperatureMaxValue = Number.MAX_SAFE_INTEGER;
  if (moistureMinValue == '')
    moistureMinValue = Number.MIN_SAFE_INTEGER;
  if (moistureMaxValue == '')
    moistureMaxValue = Number.MAX_SAFE_INTEGER;
  if (humidityMinValue == '')
    humidityMinValue = Number.MIN_SAFE_INTEGER;
  if (humidityMaxValue == '')
    humidityMaxValue = Number.MAX_SAFE_INTEGER;

  db.collection('tree').find({
    name: { "$regex": req.body.data.TreeName, "$options": "i" },
    data: { $elemMatch : {
      temperature: { "$gte": parseInt(temperatureMinValue), "$lte": parseInt(temperatureMaxValue) },
      moisture: { "$gte": parseInt(moistureMinValue), "$lte": parseInt(moistureMaxValue) },
      humidity: { "$gte": parseInt(humidityMinValue), "$lte": parseInt(humidityMaxValue) } } },
  }).toArray(function(err, treeLst){
    if(err) throw err;

    let trees = [];
    treeLst.forEach((tree) => {
      trees.push(tree.name);
    });
    console.log(trees);
    res.send(trees);
  });
});

// get tree page submit
router.post('/:treeName', function (req, res) {
  console.log(req.url);
  let checkType = req.body.data.type;
  if(checkType.includes('schedule')){
    res.send(req.body.data);
  } else if(checkType.includes('manual')) {
    res.send(req.body);
  } else if(checkType.includes('report')){
    res.send(req.body);
  } else {
    res.send('Incorrect Order!');
  }
});

// report to tree name
router.get('/report/:treeName', function (req, res){
  console.log('get report:' + req.url);
  let now = new Date();
  db.collection('tree').find({
    name: req.params.treeName,
    data: { $elemMatch : {
      date: { $lte: now }
    } }
  }).toArray(function(err, result){
    if(err) throw err;
    let data = [];
    let averageTemp=0, averageMois=0, averageHumi=0, cnt=0, current=new Date(now.toISOString().split('T')[0]);
    result[0].data.forEach((item, i) => {
      let itemDate = new Date(item.date.toISOString().split('T')[0]);
      if(itemDate < current){
        data.push({
          date: current,
          averageTemp: parseInt(averageTemp/cnt),
          averageMois: parseFloat(averageMois/cnt),
          averageHumi: parseInt(averageHumi/cnt),
        });
        current = itemDate;
        averageTemp = item.temperature;
        averageMois = item.moisture;
        averageHumi = item.humidity;
        cnt = 0;
      } else {
        averageTemp += item.temperature;
        averageMois += item.moisture;
        averageHumi += item.humidity;
      }
      cnt++;
    });
    data.push({
      date: current,
      averageTemp: parseInt(averageTemp/cnt),
      averageMois: parseFloat(averageMois/cnt),
      averageHumi: parseInt(averageHumi/cnt),
    });

    console.log(data);
    res.render('../views/report', { tree: { name: req.params.treeName, data: data } });
  });
});

// render tree page
router.get('/:treeName', function (req, res) {
  console.log(req.params.treeName);
  db.collection('tree').find({
    name: req.params.treeName,
  }).toArray(function(err, result){
    if(err) throw err;

    let temp=0, mois=0, humi=0, isWaterToday=false, lastWater=new Date('01-01-2020');

    result.forEach((item, i) => {
      temp = item.data[0].temperature;
      mois = item.data[0].moisture;
      humi = item.data[0].humidity;
      isWaterToday = (new Date(new Date().toISOString().split('T')[0]) == new Date(item.lastwater.toISOString().split('T')[0])) ? "YES" : "NO";
      lastWater = item.lastwater.getHours() + ":" + item.lastwater.getMinutes() + "T" + item.lastwater.getDate() + '/' + item.lastwater.getMonth() + '/' + item.lastwater.getFullYear();
    });

    res.render('../views/tree', { tree: { name: req.params.treeName, temperature: temp, moisture: mois, humidity: humi, isWaterToday: isWaterToday, lastWater: lastWater } });
  });
});

module.exports = { router, initDbConection };
