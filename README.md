# Car-Rental-API : White Panda
A Car Rental Agency API using Nodejs, express, Firebase and Heroku.

## Description - 
This API uses Nodejs and Expressjs for backend functionalities. Firebase Realtime Database has been used to store all data in NoSQL format. Heroku platform is used to host the API based system. 

### Heroku Base URL -
  - This project is hosted on Heroku and it's base url is - https://car-rental-wp.herokuapp.com/
  
### POSTMAN Collection -
  -  **POSTMAN** has been used to test all the endpoints of API. The collection can be accessed from  [![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/01df9583b863a5c395a4) or can be downloaded as json file from here 👉 [POSTMAN Collection JSON file](https://github.com/suvamjain/car-rental-wp/blob/master/postman%20collection/Car%20Rental%20Agency%20-%20Suvam%20Jain%20-%20White%20Panda%20.postman_collection.json)

### Model / Classes -

  - User 
    - Name
    - PhoneNo (unique ID)
    
  - Car
    - Vehicle Number (unique ID)
    - Model
    - Seating Capacity
    - Rent Per Day
    - Status
 
 ### Firebase Database URL -
  - Firebase Real Time Database can be accessed by collaborators at url - https://car-rental-wp.firebaseio.com . Snaspshots of sample data in database has been attached below.
  
  <img height="200" src="https://github.com/suvamjain/car-rental-wp/blob/master/Firebase%20db%20samples/Cars%20Model.png">
  <img height="200" src="https://github.com/suvamjain/car-rental-wp/blob/master/Firebase%20db%20samples/Users%20Model.png">
  
### Endpoints -
  - Add Car (POST Request with body params)
  - Book Car based on availability (PUT Request with body params)
  - Search Cars using filters (GET Request with query params)
  - See Car Bookings (GET Request with query params)
  - Delete a Car (DELETE Request with query and in-path params)
  - User Registration and Authorization (POST Request with body params)

### Nodejs modules used - 
  - express
  - moment
  - method-override
  - body-parser
  - firebase-admin
  
### Concepts used - 
  - middlewares
  - validation handling
  - defining routers 
  - handling json and form data
  - handling params and headers
  
### How to run the application ?
  - For **online execution**, open the POSTMAN collection and execute the sample requests for each of the 6 endpoints discussed above. [![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/01df9583b863a5c395a4)
  - For **offline execution** clone this github repository, 
    - execute `npm install` to install all necessary Node.js packages. 
    - execute `node index.js` to execute the server file 
    - Finally open POSTMAN collection and use base url as - http://localhost:5000/ for all the API requests.
