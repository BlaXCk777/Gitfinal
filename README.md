# POS System

A Point of Sale (POS) system built with Node.js, Express, and Socket.IO.

## Features

- Real-time order management
- Customer management
- Menu management
- Company/business management
- Reservations and bookings
- WebSocket support for real-time updates

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Gitfinal
```

2. Navigate to the project directory:
```bash
cd FinalFinalFinal
```

3. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

### Available Endpoints

- `/` - Main POS interface
- `/menu.html` - Menu management
- `/customers.html` - Customer management
- `/companies.html` - Company management
- `/bookings.html` - Bookings management
- `/reservations.html` - Reservations management

## Project Structure

```
FinalFinalFinal/
├── server.js           # Main server file
├── pos.html           # Main POS interface
├── package.json       # Dependencies and scripts
├── data/
│   └── db.json       # JSON database
├── public/           # Public HTML pages
│   ├── index.html
│   ├── menu.html
│   ├── customers.html
│   ├── companies.html
│   ├── bookings.html
│   ├── reservations.html
│   └── style.css
└── ...
```

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **CORS** - Cross-origin resource sharing

## License

ISC

## Author

Your Name
