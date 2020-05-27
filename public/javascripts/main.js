function panel_toggle(){
  let filterPanel = document.getElementsByClassName('filter-panel')[0];
  if(filterPanel.style.display === 'none' || filterPanel.style.display === ''){
    filterPanel.style.cssText = 'display: flex !important';
  } else {
    filterPanel.style.cssText = 'display: none !important';
  }
}

const getTreeFilter = ()=>
  axios.get('/operation/getFilterTrees')
    .then((res)=>res.data)
    .catch((err)=>{
      console.log(err);
  });;

const postTreeFilter = (data)=>
  axios.post('/operation/filterTreeList', {data})
  .then((resp)=>resp.data);;;

function createTreeListElement(treeName){
  let liTag = document.createElement('li');
  liTag.className = 'list-group-item border-0 p-1';
  let aTag = document.createElement('a');
  aTag.href = '/' + treeName;
  let buttonTag = document.createElement('button');
  buttonTag.className = 'btn btn-success tree-elems w-100';
  buttonTag.type = 'button';
  buttonTag.textContent = treeName;
  aTag.appendChild(buttonTag);
  liTag.appendChild(aTag);
  return liTag;
}

function filter_submit(evt){
	evt.preventDefault();
	postTreeFilter({
		TreeName: evt.target[1].value,
		TemperatureMinValue: evt.target[2].value,
		TemperatureMaxValue: evt.target[3].value,
		MoistureMinValue: evt.target[4].value,
		MoistureMaxValue: evt.target[5].value,
		HumidityMinValue: evt.target[6].value,
		HumidityMaxValue: evt.target[7].value,
	}).then(res=>{
    console.log(res);
    let ulTree = document.getElementsByClassName('list-tree')[0];
    while(ulTree.firstChild){
      ulTree.removeChild(ulTree.firstChild);
    }
    res.forEach((item, i) => {
      ulTree.appendChild(createTreeListElement(item));
    });
  });
  panel_toggle();
}

const postTreeWater = (data, treeName)=>
  axios.post(treeName, {data: data})
  .then((resp)=>resp.data);

function tree_schedule_water(evt, treeName){
	evt.preventDefault();
	postTreeWater({
		hh: evt.target[1].value,
		mm: evt.target[2].value,
		waterLvl: evt.target[3].value,
    type: 'schedule',
	}, treeName).then(res=>{
    console.log('test');
    console.log(res);
  }).catch(error => {
      console.log(error.response);
  });
}

function tree_manual_water(evt, treeName){
  console.log(evt.target);
	evt.preventDefault();
	postTreeWater({
		flow: evt.target[1].value,
		sensor: evt.target[3].value,
    type: 'manual'
	}, treeName).then(res=>{
    console.log(res);
  });
  panel_toggle();
}

function getFullyReport(treeName){
  axios.post('/report/' + treeName, { data: treeName }).then((resp)=>{
    console.log(resp);
  }).catch(error=>{
    console.log(error.response);
  });

}
