# Digital Garden API

The backend for the Digital Garden application, built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (Authentication)
- dotenv (Environment management)
- CORS enabled  

## Getting Started  

### 1. Clone the repo  

git clone https://github.com/bomjuk94/Digital-Garden-API  

### 2. Install Dependencies  

cd Digital-Garden-API-main  
npm install  

### 3. Setup environment variables  

PORT=5000  
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/database-name  
JWT_SECRET=your_jwt_secret   

### 4. Start the Server  

npm run dev  

### API Endpoints  

#### Auth  

POST /api/register  

POST /api/login  

#### Profile  

GET /api/profile/  

PATCH /api/profile/balance  

PUT /api/profile/update  

PATCH /api/profile/usedPlantCapacity  

PATCH /api/profile/onboardingStatus  

#### Seeds  

GET /api/seeds  

PATCH /api/seeds/decrement  

PUT /api/seeds/count  

PUT /api/seeds/unlock  

PUT /api/seeds/update    

#### Inventory

GET /api/inventory  

PATCH /api/inventory/count  

PUT /api/inventory/update  

#### Shop

GET /api/shop  

PUT /api/shop/update  

#### Purchases

GET /api/purchases  

PUT /api/purchases/update  

#### Plants

GET /api/plants  

POST /api/plants/add  

PATCH /api/plants/remove  

PUT /api/plants/buffs  

PUT /api/plants/update  

#### Upgrades

GET /api/upgrades  

PATCH /api/upgrades/add  

#### Supplies

GET /api/supplies  

PATCH /api/supplies/add  

PATCH /api/supplies/remove  

#### Garden

GET /api/garden  

PUT /api/garden/update  