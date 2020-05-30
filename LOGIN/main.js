const inputs = document.querySelectorAll('.input')

function focusFunc(){
    let parent = this.parentNode.parentNode;
    parent.classList.add('focus');
}

function blurFunc(){
    let parent = this.parentNode.parentNode;
    if(this.value == ""){
        parent.classList.remove('focus');
    }
}

function visible(){ 
    var x = document.getElementById("myinput")
    var y = document.getElementById("hide1")
    var z = document.getElementById("hide2")

    if(x.type ==='password'){
        x.type = "text";
        y.style.display = "block";
        z.style.display = "none";
        y.style.color = "#38d39f";
    }
    else {
        x.type = "password";
        y.style.display = "none";
        z.style.display = "block";
    }
}

inputs.forEach(input=>{
    input.addEventListener('focus', focusFunc);
    input.addEventListener('blur', blurFunc);
})