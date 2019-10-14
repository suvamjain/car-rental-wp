module.exports = class User {

    constructor(name) {
        this.name = name;      //user full name
    }
    
    //setters methods
    setName(name) {
        this.name = name;
    }

    //getters methods
    getName() {
        return this.name;
    }

    print(){
        var string = 'User-> name: '+ this.name;
        //console.log(string);
        return string;
    }
};