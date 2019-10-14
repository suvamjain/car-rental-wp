var express = require("express"); 
var moment = require("moment");
var methodOverride = require('method-override');
var bodyParser = require('body-parser');
var firebase = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");
var app = express();
app.use(bodyParser.json()); //need to parse HTTP request body
app.use(ignoreFavicon);
app.use(methodOverride('_method'));

const Car = require('./models/car.js');
const User = require('./models/users.js');
const PORT = process.env.PORT || 5000
const regex_date = /^\d{4}\-\d{2}\-\d{2}$/;

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://car-rental-wp.firebaseio.com"
});

var carsRef = firebase.database().ref().child("Cars");
var usersRef = firebase.database().ref().child("Users");

//Middleware used to handle certain requests based on users
app.use((req, res, next)=> {
    console.log("middleware says URL: ",req.url);
    return next();
});

app.get('/', function (req, res) {
    console.log("HTTP GET Request");
    res.redirect('https://github.com/suvamjain/car-rental-wp/blob/master/README.md');
});

//1. Add new cars 
app.post('/add', function (req, res) {

	console.log("ADD NEW CAR - HTTP POST Request");
	var veh_no = req.body.VehNo;
	var model = req.body.Model;
    var seat_cap = req.body.SeatCap;
    var rent_day = req.body.RentDay;

    //create a new car object
    let car = new Car(model.toUpperCase(), seat_cap, rent_day);

    if(veh_no != null && car.getModel() != null && car.getSeatCap() != null && car.getRentPerDay() != null) {
        carsRef.child(veh_no).once('value', function(snapshot) {
            if (snapshot.exists()) {
                console.log('Car with this vehicle number already exists');
                res.status(406).json({id: "-1", message: "Car with this vehicle number already exists"});
            }
            else {
                car.setSeatCap(parseInt(seat_cap));
                car.setRentPerDay(parseInt(rent_day));
                carsRef.child(veh_no).set(car, function(error) {
                    if (error) {
                        console.log("Car could not be saved." + error);
                        res.status(406).json({id: "-1", message: "Car could not be saved."});
                    } 
                    else {
                        res.status(200).json({id: "1", message: "Car with vehicle number - " + veh_no + " added successfully"});
                    }
                });
            }
        });
    }
    else {
        console.log("Error: Please fill all the fields");
        res.status(406).json({id: "-1", message: "Error: Please fill all the fields"});
    }
});

//2. Book a specific car using vehicle number based on its availability.
app.put('/book', function (req, res) {

	console.log("BOOK CAR - HTTP PUT Request");

    var veh_no = req.body.VehicleNo;
    var c_id = req.body.PhoneNo;
    var start_d = req.body.StartDate;
    var noOfDays = req.body.NoOfDays;

    if(veh_no == null || c_id == null || start_d == null || noOfDays == null) {
        return res.status(406).json({id: "-1", message: "Please fill all the fields (VehicleNo, PhoneNo, StartDate, NoOfDays)"});
    }

    if(c_id.match(/\d/g).length !=10) {
        return res.status(406).json({id: "-1", message: "Please enter valid Phone Number of 10 digits"});
    }

    if(!isDateValid(start_d)) {
        return res.status(406).json({id: "-1", message: "Please enter valid start date in format YYYY-MM-DD"});
    }
    
    if(moment(start_d).diff(moment(), 'days') < 0) {
        return res.status(406).json({id: "-1", message: "Start Date can't be before today's date"});
    }

    if(parseInt(noOfDays) < 1) {
        return res.status(406).json({id: "-1", message: "Booking has to be done for atleast 1 day"});
    }
    
    let end_d = moment(start_d).add(parseInt(noOfDays), "days");
    var ref = start_d + "_" + end_d.format("YYYY-MM-DD");

    //--  first run both async function for checking user and vehicle existence 
        Promise.all([searchByVehNo(veh_no), checkPhone(c_id)])
        .then(function(snapshots) {
            if(snapshots[1].id != -1) {
                return res.status(404).json({id: "-1", message: "Phone Number Not Registered"});
            } 
            else {
                let car =  snapshots[0];
                if(car == null) {
                    return res.status(404).json({id: "-1", message: 'Invalid Vehicle Number'});
                } else {
                    let available = true;
                    if(car.getStatus() != null) {
                        let bookings = car.getStatus();
                        Object.keys(bookings).some(function(key) {
                            var dates = key.split("_");
                            let bs = moment(dates[0]);  //this booking start
                            let be = moment(dates[1]);  //this booking end
                            if(isTimeClashing(bs, be, moment(start_d), end_d)) {
                                console.log("Clashing with " + bookings[key] + " booking at " + key);
                                available = false;
                                return res.status(406).json({id: "-1", message: "Clashing with booking at " + key, car : car});
                            }
                        });
                    }
                    else {
                        console.log("No status present");
                    }
                    //save the booking
                    if(available) {
                        carsRef.child(veh_no + "/status/").child(ref).set(c_id, function(error) {
                            if (error) {
                                console.log("Booking could not be done." + error);
                                return res.status(406).json({id: "-1", message: "Booking could not be done." + error});
                            } 
                            else {
                                console.log("Booking done successfully.");
                                car.addToStatus(ref,c_id);
                                return res.status(200).json({id: "1", 
                                            message: "Booking done successfully. Amount INR " + car.getRentPerDay() * noOfDays, car : car});
                            }
                        });
                    }
                }
            }
        });
    //--
});

//3. Show the cars that are available to book on a date, time, seating capacity or other filters.
app.get('/search', function (req, res) {
    console.log("SEARCH CAR - HTTP GET Request");
    var start_d = req.query.StartDate;
    var noOfDays = req.query.NoOfDays;
    var seat_cap = req.query.SeatCap;
    var model = req.query.Model;
    
    if(start_d == null || noOfDays == null) {
        console.log("Fill Booking Start Date and Number of Days");
        return res.status(406).json({id: "-1", message: "Fill Booking Start Date and Number of Days"});
    }

    if(!isDateValid(start_d)) {
        return res.status(406).json({id: "-1", message: "Please enter valid start date in format YYYY-MM-DD"});
    }
    
    if(moment(start_d).diff(moment(), 'days') < 0) {
        return res.status(406).json({id: "-1", message: "Start Date can't be before today's date"});
    }

    if(parseInt(noOfDays) < 1) {
        return res.status(406).json({id: "-1", message: "Booking has to be done for atleast 1 day"});
    }

    let end_d = moment(start_d).add(parseInt(noOfDays), "days");
    var ref = start_d + "_" + end_d.format("YYYY-MM-DD");

    //filter by model first and then apply remaining filters
    if(model != null) {
        new Promise(function(resolve, reject) {
            resolve(searchByModel(model, seat_cap, ref));          // Do async job
	    }).then(function(cars) {
            if(Object.keys(cars).length == 0) {
                return res.status(404).json({id: "-1", message: 'No Cars found for this filter'});
            } 
            else {
                return res.status(200).json({CarsFound: cars});
            }
        });
    }
    //filter by seat cap first and then apply remaining filters
    else if(seat_cap != null) {
        new Promise(function(resolve, reject) {
            resolve(searchBySeatCap(parseInt(seat_cap), ref));        // Do async job
	    }).then(function(cars) {
            if(Object.keys(cars).length == 0) {
                return res.status(404).json({id: "-1", message: 'No Cars found for this filter'});
            } 
            else {
                return res.status(200).json({CarsFound: cars});
            }
        });
    }
    //filter by booking duration only
    else {
        console.log("Filtering by time " + ref);
        var carsFetched = {};
        let sd = moment(start_d);   //my booking start
        let ed = end_d;             //my booking end
        carsRef.orderByChild("seat_cap").once("value", function(snapshot) {
            snapshot.forEach(function(childSnapshot) {
                var veh_no = childSnapshot.key;
                var childData = childSnapshot.val();
                //---
                var available = true;
                console.log("For v_no : " + veh_no + " ---> " + JSON.stringify(childData));
                if(childSnapshot.hasChild("status")) {
                    let bookings = childData.status;
                    Object.keys(bookings).some(function(key) {
                        var dates = key.split("_");
                        let bs = moment(dates[0]);  //this booking start
                        let be = moment(dates[1]);  //this booking end
                        if(isTimeClashing(bs, be, sd, ed)) {
                            console.log("    Clashing with " + bookings[key] + " booking at " + key);
                            available = false;
                            return true;
                        }
                    });
                }
                else {
                    console.log("    No status present");
                }
                if(available) {
                    let c = new Car(childData.model, childData.seat_cap, childData.rent_day);
                    c.setStatus(childData.status);
                    carsFetched[veh_no] = c;
                }
            });
            if(Object.keys(carsFetched).length == 0) {
                return res.status(404).json({id: "-1", message: 'No Cars found for this filter'});
            } 
            else {
                return res.status(200).json({CarsFound: carsFetched});
            }
        });
    }
});

//4. Using Car Model (only) show the details of a particular car and its currently active booking.
app.get('/searchVehicleNo', function (req, res) {

    console.log("SEARCH CAR BY VEHICLE NUMBER - HTTP GET Request");

    var veh_no = req.query.VehicleNo;
    if(veh_no != null && veh_no != "") {
        new Promise(function(resolve, reject) {
            // Do async job
            resolve(searchByVehNo(veh_no));
	    }).then(function(car) {
            if(car == null) {
                return res.status(404).json({id: "-1", message: 'Invalid Vehicle Number'});
            } 
            else {
                return res.status(200).json({car : car});
            }
        });
    }
    else {
        console.log("Error: Please enter vehicle number of car");
        return res.status(406).json({id: "-1", message : "Please enter vehicle number of car"});
    }
});

//5. Delete a Car from the system and ensure that the car should is not already booked.
app.delete('/delete/:veh_no', function (req, res) {

   console.log("DELETE A CAR - HTTP DELETE Request");

   var veh_no = req.params.veh_no;
   var ignoreBookings = req.query.IgnoreBookings;
    if(veh_no != null && veh_no != "") {
        new Promise(function(resolve, reject) {
            // Do async job
            resolve(searchByVehNo(veh_no));
	    }).then(function(car) {
            if(car == null) {
                return res.status(404).json({id: "-1", message: 'Invalid Vehicle Number'});
            } 
            else {
                let available = true;
                if(car.getStatus() != null) {
                    let bookings = car.getStatus();
                    Object.keys(bookings).some(function(key) {
                        var dates = key.split("_");
                        // let bs = moment(dates[0]);  //this booking start
                        let be = moment(dates[1]);  //this booking end
                        if(be.isAfter(moment())) {
                            console.log("Ongoing/Future Booking end on " + key);
                            available = false;
                            return true;
                        }
                    });
                }
                else {
                    console.log("No status present");
                    available = false;
                    return new Promise(function(resolve, reject) {
                        // Do async job
                        resolve(deleteCar(veh_no));
                    }).then(function(flag) {
                        return res.status(200).json({id: "1", message : "Vehicle deleted successfully"});
                    });
                }
                if(available || (!available && ignoreBookings !=  null && ignoreBookings.toLowerCase() == "yes")) {
                    return new Promise(function(resolve, reject) {
                        // Do async job
                        resolve(deleteCar(veh_no));
                    }).then(function(flag) {
                        return res.status(200).json({id: "1", message : "Vehicle deleted successfully"});
                    });
                }
                else {
                    return res.status(406).json({id: "-1", 
                    message: 'This car has ongoing or future bookings. If you still want to delete, pass IgnoreBookings = yes in query params' , car : car});
                }
            }
        });
    }
    else {
        console.log("Error: Please enter vehicle number of car");
        return res.status(406).json({id: "-1", message : "Please enter vehicle number of car"});
    }
});

//6. User Authentication using phone number and name
app.post('/register', function(req, res) {

    console.log("REGISTER NEW USER - HTTP POST Request");
    var name = req.body.Name;
    var phone = req.body.Phone;

    if(name == null || phone == null) {
        return res.status(404).json({id: "-1", message: "Please fill all the fields (Name, Phone)"});
    }

    if(phone.match(/\d/g).length !=10) {
        return res.status(404).json({id: "-1", message: "Please enter valid Phone Number of 10 digits"});
    }

    new Promise(function(resolve, reject) {
        resolve(checkPhone(phone));          // Do async job
    }).then(function(state) {
        if(state.id == -1) {    //phone number already registered
            return res.status(404).json({id: "-1", message: state.message});
        }
        else {
            let user = new User(name);
            usersRef.child(phone).set(user, function(error) {
                if (error) {
                    console.log("User could not be registered." + error);
                    return res.status(404).json({id: "-1", message: "User could not be registered." + error});
                } 
                else {
                    console.log("User registered successfully");
                    return res.status(200).json({id: "1", message: "User registered successfully"});
                }
            });
        }
    });
});

//handle all the other unmatched urls here and set status to 404
app.get('*', function(req, res) {
    res.status(404).send("Sorry, Can't find any Resource for this link");
});

//utility function to check if user exists with this phone
async function checkPhone(phone) {
    try {
        const snapshot = await usersRef.child(phone).once("value");
        if(snapshot.exists()) {
            console.log("User with this phone number already exists");
            return {id: '-1', message: "Registrtion failed. User with this phone number already exists"};
        }
        else {
            return {id: '1', message: "Phone number available"};
        }
    } catch (error) {
        console.log(error);
        return {id: '100', message: "Some Error occured " + error};
    }
}

//utility function to search a car by vehicle number
async function searchByVehNo (veh_no) {
    try {
        const snapshot = await carsRef.child(veh_no).once("value");
        if (snapshot.exists()) {    //valid vehicle number
            let childData = snapshot.val();
            let c = new Car(childData.model, childData.seat_cap, childData.rent_day);
            c.setStatus(childData.status);
            return c;
        } 
        else {
            console.log("Invalid vehicle number");
            return null;
        }
    }
    catch (error) {
        // Something went wrong.
        console.error(error);
        return null;
    }
}

//utility function to search a car by seating capacity and then filter using duration
async function searchBySeatCap (cap, duration) {
    var carsFetched = {};
    try {
        const snapshot = await carsRef.orderByChild("seat_cap").equalTo(cap).once("value");
        snapshot.forEach(function (childSnapshot) {
            var veh_no = childSnapshot.key;
            var childData = childSnapshot.val();
            //---
            var available = true;
            console.log("For v_no : " + veh_no + " ---> " + JSON.stringify(childData));
            if(childData.status != null) {
                let bookings = childData.status; //all bookings
                let sd = moment(duration.split("_")[0]);  //my booking start
                let ed = moment(duration.split("_")[1]);  //my booking end
                Object.keys(bookings).some(function(key) {
                    var dates = key.split("_");
                    let bs = moment(dates[0]);  //this booking start
                    let be = moment(dates[1]);  //this booking end
                    if(isTimeClashing(bs, be, sd, ed)) {
                        console.log("    Clashing with " + bookings[key] + " booking at " + key);
                        available = false;
                        return true;
                    }
                });
            }
            else {
                console.log("    No status present");
            }
            if(available) {
                let c = new Car(childData.model, childData.seat_cap, childData.rent_day);
                c.setStatus(childData.status);
                carsFetched[veh_no] = c;
            }
            //---
        });
        return carsFetched;
    }
    catch (error) {
        // Something went wrong.
        console.error(error);
        return {};
    }
}

//utility function to search a car by model and then filter using seat capacity or duration
async function searchByModel (model, seatCap, duration) {
    var carsFetched = {};
    try {
        const snapshot = await carsRef.orderByChild("model").equalTo(model.toUpperCase()).once("value");
        snapshot.forEach(function (childSnapshot) {
            var veh_no = childSnapshot.key;
            var childData = childSnapshot.val();
            //---
            var available = true;
            console.log("For v_no : " + veh_no + " ---> " + JSON.stringify(childData));
            if(seatCap || duration) {
                //filter based on seating capacity
                if(seatCap != null && childData.seat_cap < seatCap) {
                    console.log("    Lesser Seating Capacity");
                    available = false;
                }
                //filter based on bookings clash
                else if(duration != null) {
                    if(childData.status != null) {
                        let sd = moment(duration.split("_")[0]);    //my booking start
                        let ed = moment(duration.split("_")[1]);    //my booking end
                        let bookings = childData.status;            //all bookings
                        Object.keys(bookings).some(function(key) {
                            var dates = key.split("_");
                            let bs = moment(dates[0]);  //this booking start
                            let be = moment(dates[1]);  //this booking end
                            if(isTimeClashing(bs, be, sd, ed)) {
                                console.log("    Clashing with " + bookings[key] + " booking at " + key);
                                available = false;
                                return true;
                            }
                        });
                    }
                    else {
                        console.log("    No status present");
                    }
                }
            }
            if(available) {
                let c = new Car(childData.model, childData.seat_cap, childData.rent_day);
                c.setStatus(childData.status);
                carsFetched[veh_no] = c;
            }
            //---
        });
        return carsFetched;
    }
    catch (error) {
        // Something went wrong.
        console.error(error);
    }
}

//utility function to delete a car by vehicle number
function deleteCar (veh_no) {
    return carsRef.child(veh_no).remove(
        function(error) {
            if (error) {
                console.log("Delete failed: " + error.message)
                return -1;
            }
            else {
                console.log("Delete succeeded.");
                return 1;
            };
    });
}

//utility function to check if booking time clashes with already booked slots of a car
function isTimeClashing (bs, be, sd, ed) {
    //@params sd : start date, ed : end date, bs : already booked start date, be : already booked end date
    if(!(sd.isBetween(bs,be) || ed.isBetween(bs,be)) && (ed.isSameOrBefore(bs) || sd.isSameOrAfter(be))) {
        return false;   //my time doesn't clash with this booking
    }
    return true;        //my time clashes with this booking
}

//utility function to check if date is in correct format and is valid
function isDateValid(date) {
    if(!regex_date.test(date) || !moment(date).isValid()) {
        return false;
    }
    return true;
}

function ignoreFavicon(req, res, next) {
    if (req.originalUrl === '/favicon.ico') {
        res.status(204).json({nope: true});
    } else {
        next();
    }
}

var server = app.listen(PORT, () => console.log(`Listening on ${ PORT }`))