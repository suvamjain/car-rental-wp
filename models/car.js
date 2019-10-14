module.exports = class Car {

    constructor(model, seat_cap, rent_day) {
        // this.veh_no = veh_no;    //vehicle number
        this.model = model;         //car model
        this.seat_cap = seat_cap;   //seating capacity
        this.rent_day = rent_day;   //rent-per-day(in INR)
        this.status = {};
    }
    
    //setters methods
    setModel(model) {
        this.model = model;
    }
    setSeatCap(seat_cap) {
        this.seat_cap = seat_cap;
    }
    setRentPerDay(rent_day) {
        this.rent_day = rent_day;
    }
    setStatus(status) {        
        this.status = status;
    }

    addToStatus(dur, uid) {
        if(this.status == null) 
            this.status = {};
        this.status[dur] = uid;
    }

    //getters methods
    getModel() {
        return this.model;
    }
    getSeatCap() {
        return this.seat_cap;
    }
    getRentPerDay() {
        return this.rent_day;
    }
    getStatus() {        
        return this.status;
    }

    print(){
        var string = 'Car-> model: '+ this.model + ' seat_cap: '+ this.seat_cap + ' rent_day: '+ this.rent_day + ' status: '+ this.getStatus();
        //console.log(string);
        return string;
    }
};