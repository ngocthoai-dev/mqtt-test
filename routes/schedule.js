const db = require('../routes/dbConnection').db;

let schedule_water_list={}, treeInWater={};
// {
//   treeName: {
//     user: [],
//     isWatering: false,
//     time: '',
//   },
// }

function wateringSchedule(schedule, treeName, users, level) {
  console.log("watering on:", treeName, "of", users);
  let today = "water." + new Date().toISOString().split('T')[0], time=new Date().getHours().toString().padStart(2, "0") + ":" + new Date().getMinutes().toString().padStart(2, "0");
  db().collection('tree').findOneAndUpdate({
    name: treeName,
    user: users,
  }, {
    $push: {
      [today]: { $each: [time], $position: 0, }
    },
    $set: { isWatering: true, },
  }, { upsert: true, },
  function(err, res){
    if(err) throw err;
    // console.log(res);
  });

  schedule['timeout'] = setTimeout(()=>{
    console.log("stop watering on:", treeName, "of", users);
    db().collection('tree').updateOne({
      name: treeName,
      user: users,
    }, {
      $set: { isWatering: false, },
    }, function(err, res){
      if(err) throw err;
      // console.log(res);
    });
  }, 1000*level);
}

const deleteScheduleList = (treeName)=>{
  clearInterval(schedule_water_list[treeName].interval);
  clearTimeout(schedule_water_list[treeName].timeout);
}

let fetch_schedule_water = ()=>{
  setInterval(()=>{
    // console.log('auto');

    db().collection('tree').find({
    }).toArray((err, trees)=>{
      if(err) throw err;

      trees.forEach((tree, i) => {
        if(tree.schedule && tree.schedule.frequency != 0 && tree.schedule.length>0){
          if((treeInWater[tree.name] != undefined && treeInWater[tree.name].time.localeCompare(tree.schedule.time)) || treeInWater[tree.name] == undefined){
            if(schedule_water_list[tree.name]){
              deleteScheduleList(tree.name);
            }
            let scheduleTime = new Date();
            scheduleTime.setHours(tree.schedule.time.toString().split(':')[0], tree.schedule.time.toString().split(':')[1]);
            if(scheduleTime <= new Date()){
              scheduleTime.setDate(scheduleTime.getDate()+1);
            }
            let timeToSchedule = Math.abs(new Date() - scheduleTime);
            treeInWater[tree.name] = {
              user: tree.user,
              isWatering: tree.isWatering,
              time: tree.schedule.time,
            }
            // console.log(timeToSchedule);

            setTimeout(()=>{
              var schedule={}, treeName=tree.name, users=tree.user;
              wateringSchedule(schedule, treeName, users, tree.schedule.level);
              schedule['interval'] = setInterval(wateringSchedule, 1000*60*60*24*tree.schedule.frequency);

              schedule_water_list[tree.name] = schedule;
            }, timeToSchedule);
          }
        }
      });
    });
  }, 1000*60);
}

module.exports = {
  fetch_schedule_water,
  scheduleList: {
    getScheduleList: ()=>schedule_water_list,
    deleteScheduleList: deleteScheduleList,
  },
};
