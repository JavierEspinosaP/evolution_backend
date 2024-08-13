<h1 align="center">Evolution Backend</h1>

## <h2 align="center">Overview</h2>

The **Evolution Backend** is a Node.js application designed to simulate and manage the evolution of virtual creatures within a dynamic environment. The backend leverages multithreading to handle real-time state updates and communicates with clients via WebSockets. This system is built to facilitate complex simulations where creatures interact with their environment, consume food, and evolve over time based on predefined rules.

## <h2 align="center">Features</h2>

- **Real-Time Simulation**: The backend handles continuous updates of the simulation state using worker threads, ensuring efficient processing and smooth real-time interactions.
- **WebSocket Communication**: Clients receive updates through WebSocket connections, allowing for real-time monitoring and interaction with the simulation.
- **State Management**: The application maintains a detailed state of all entities (creatures, food, etc.) and updates it based on specific evolutionary rules.
- **Data Compression**: To optimize network usage, state updates sent to clients are compressed using zlib.

## <h2 align="center">Installation</h2>

### Prerequisites

Ensure you have the following installed:

- Node.js (version 14 or higher)
- NPM

### Setup

1. Clone the repository:
   ``git clone https://github.com/JavierEspinosaP/evolution_backend.git``

2. Navigate to the project directory:
   ``cd evolution_backend``

3. Install the dependencies:
   ``npm install``

## <h2 align="center">Usage</h2>

To start the server, use the following command:

``npm start``

The server will start and be accessible at `http://localhost:3000`.

### WebSocket Server

The WebSocket server runs on the same port as the HTTP server. Clients can connect to receive real-time updates of the simulation state. The server will automatically broadcast updates to all connected clients.

## <h2 align="center">Project Structure</h2>

- **`server.js`**: Initializes the Express server and WebSocket server, handles incoming connections, and delegates state update tasks to the worker thread.
- **`worker.js`**: Manages the real-time updating of the simulation state in a separate thread to ensure the main server remains responsive.
- **`logic.js`**: Contains the core logic for state management, including functions for updating the state of creatures, food, and handling evolution mechanics.
- **`classes.js`**: Defines the `Creature` and `Food` classes, including their behaviors, interactions, and properties.

## <h2 align="center">Dependencies</h2>

The project relies on several key packages:

- express: For handling HTTP server functionalities.
- ws: WebSocket implementation for real-time communication.
- worker_threads: To manage state updates in a separate thread.
- zlib: For compressing data sent over WebSockets to reduce bandwidth usage.
- uuid: For generating unique identifiers for creatures and food items.
- nodemon: For automatic server restarts during development.

Refer to the `package.json` for a complete list of dependencies.

## <h2 align="center">Contributing</h2>

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Make your changes.
4. Submit a pull request with a detailed description of your changes.

## <h2 align="center">License</h2>

This project is licensed under the ISC License. See the `LICENSE` file for more details.

## <h2 align="center">Contact</h2>

For any inquiries or issues, please reach out via GitHub or directly through email.
