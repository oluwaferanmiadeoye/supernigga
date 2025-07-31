// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCg5F2_5C9dnl2oCj2ad9gxsxdPWRbcaOs",
  authDomain: "omoshiroi-8487c.firebaseapp.com",
  projectId: "omoshiroi-8487c",
  storageBucket: "omoshiroi-8487c.firebasestorage.app",
  messagingSenderId: "200240035047",
  appId: "1:200240035047:web:87dae58b97ef25044a5e42",
  measurementId: "G-2Z21WPFC9C"
};

// Initialize Firebase with persistence
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

// Enable offline persistence for Firestore
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.log('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser doesn't support persistence
      console.log('Persistence not supported by browser');
    }
  });

// Configure Auth persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    console.error('Auth persistence error:', error);
  });

// Game state
let currentRoom = null;
let currentUser = null;
let isHost = false;
let gameTimer = null;
let roomListener = null;

// Categories for the game
const categories = ["name", "animal", "place", "food", "thing"];
const categoryIcons = {
  name: '<i class="fas fa-user"></i>',
  animal: '<i class="fas fa-paw"></i>',
  place: '<i class="fas fa-globe-americas"></i>',
  food: '<i class="fas fa-utensils"></i>',
  thing: '<i class="fas fa-cube"></i>',
};

// Dictionary for validating answers
const validWords = {
  animal: new Set([
    "ant", "antelope", "alligator", "alpaca", "ape",
    "bear", "beaver", "bird", "bison", "bat",
    "cat", "camel", "cheetah", "chicken", "cow",
    "dog", "deer", "dolphin", "donkey", "dove",
    "elephant", "eagle", "eel",
    "fish", "fox", "frog",
    "goat", "giraffe", "gorilla",
    "horse", "hippo", "hamster",
    "iguana",
    "jaguar",
    "kangaroo", "koala",
    "lion", "leopard", "llama",
    "monkey", "mouse", "mole",
    "newt",
    "octopus", "owl", "ostrich",
    "panda", "parrot", "pig",
    "quail",
    "rabbit", "raccoon", "rat",
    "sheep", "snake", "squirrel",
    "tiger", "turtle", "turkey",
    "unicorn",
    "vulture",
    "whale", "wolf", "wombat",
    "yak",
    "zebra"
  ]),
  place: new Set([
    "alabama", "alaska", "arizona", "arkansas",
    "bangkok", "berlin", "boston", "brazil",
    "california", "canada", "chicago", "china",
    "denmark", "dubai",
    "egypt", "england", "ethiopia",
    "finland", "france",
    "germany", "greece",
    "hawaii", "holland",
    "iceland", "india", "indonesia", "iran", "iraq", "ireland", "italy",
    "japan", "jordan",
    "kenya", "kuwait",
    "london", "lebanon",
    "madrid", "malaysia", "mexico",
    "nepal", "netherlands", "nigeria", "norway",
    "ohio", "oregon", "osaka",
    "paris", "peru", "poland", "portugal",
    "qatar",
    "rome", "russia",
    "spain", "sweden", "switzerland", "sydney",
    "texas", "thailand", "tokyo",
    "uganda", "ukraine",
    "venice", "vietnam",
    "wales",
    "yemen",
    "zambia", "zimbabwe"
  ]),
  food: new Set([
    "apple", "apricot", "avocado",
    "banana", "beef", "bread", "broccoli",
    "cake", "carrot", "cheese", "chicken",
    "dates",
    "egg", "eggplant",
    "fish", "fries",
    "garlic", "grape",
    "ham", "honey",
    "ice cream",
    "jam", "jelly",
    "kale", "ketchup",
    "lemon", "lime",
    "mango", "meat", "milk",
    "noodles", "nuts",
    "orange", "olive",
    "pasta", "peach", "pear",
    "quinoa",
    "rice", "raisin",
    "salmon", "salt", "sugar",
    "taco", "tomato", "tuna",
    "udon",
    "vanilla",
    "waffle", "water",
    "yam", "yogurt",
    "zucchini"
  ]),
  thing: new Set([
    "alarm", "arrow",
    "bag", "ball", "book", "box",
    "car", "chair", "clock",
    "desk", "door",
    "ear", "egg",
    "fan", "flag",
    "gate", "glass",
    "hat", "house",
    "iron",
    "jar", "jet",
    "key", "knife",
    "lamp", "lock",
    "map", "mask",
    "nail", "needle",
    "oven",
    "pan", "pen",
    "queen",
    "radio", "ring",
    "shoe", "sofa",
    "table", "toy",
    "umbrella",
    "vase",
    "wall", "watch",
    "xray",
    "yarn",
    "zipper"
  ])
};

// Initialize anonymous authentication
auth
  .signInAnonymously()
  .then((result) => {
    currentUser = result.user;
    console.log("Signed in anonymously:", currentUser.uid);
    
    // Set user properties in Analytics
    analytics.setUserProperties({
      userType: 'anonymous',
      userId: currentUser.uid
    });

    // Log user sign-in event
    analytics.logEvent('user_login', {
      method: 'anonymous',
      userId: currentUser.uid
    });

    // Store user in a separate collection for tracking
    return db.collection('users').doc(currentUser.uid).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      loginCount: firebase.firestore.FieldValue.increment(1),
      isAnonymous: true
    }, { merge: true });
  })
  .catch((error) => {
    console.error("Authentication failed:", error);
    alert("Failed to connect. Please refresh the page.");
    
    // Log error event
    analytics.logEvent('login_error', {
      error_code: error.code,
      error_message: error.message
    });
  });

// Screen management
function showScreen(screenId) {
  const body = document.body;
  
  // Remove all existing wrappers and the container
  const existingWrappers = document.querySelectorAll('.screen-wrapper');
  const container = document.querySelector('.container');
  
  if (screenId === "homeScreen") {
    // For home screen, just reload the page
    location.reload();
    return;
  }
  
  // Remove container if it exists
  if (container) {
    container.remove();
  }
  
  // Remove any existing screen wrappers
  existingWrappers.forEach(wrapper => wrapper.remove());
  
  // Create new wrapper for the current screen
  const screenWrapper = document.createElement('div');
  screenWrapper.className = 'screen-wrapper';
  
  // Move the original screen instead of cloning
  const screen = document.getElementById(screenId);
  if (!screen) return;
  
  screen.classList.add('active');
  screenWrapper.appendChild(screen);
  body.appendChild(screenWrapper);

  // Reattach Firebase listeners if needed
  if (screenId === "lobbyScreen") {
    setupRoomListener();
  }
  
  // Focus input fields if needed
  if (screenId === "joinScreen") {
    const roomCodeInput = screen.querySelector("#roomCode");
    if (roomCodeInput) {
      roomCodeInput.focus();
    }
  }

  // Make sure host controls are visible if the user is host
  if (screenId === "lobbyScreen" && isHost) {
    const hostControls = screen.querySelector("#hostControls");
    if (hostControls) {
      hostControls.style.display = "block";
    }
  }

  // Setup game screen if needed
  if (screenId === "gameScreen") {
    setupGameInputListeners();
  }
}

function showHome() {
  location.reload();
}

function showJoinRoom() {
  const joinScreen = document.getElementById("joinScreen");
  const screenWrapper = document.createElement('div');
  screenWrapper.className = 'screen-wrapper';
  
  // Clear existing content
  document.body.innerHTML = '';
  
  // Setup join screen
  joinScreen.classList.add('active');
  screenWrapper.appendChild(joinScreen);
  document.body.appendChild(screenWrapper);
  
  // Focus the name input
  setTimeout(() => {
    const nameInput = document.getElementById("joinPlayerName");
    if (nameInput) nameInput.focus();
  }, 100);
}

// Room management
function generateRoomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
}

async function createRoom() {
  const playerName = document.getElementById("playerName").value.trim();
  if (!playerName) {
    alert("Please enter your name!");
    return;
  }

  if (!currentUser) {
    // Try to authenticate again
    try {
      const authResult = await auth.signInAnonymously();
      currentUser = authResult.user;
      console.log("Re-authenticated:", currentUser.uid);
    } catch (error) {
      console.error("Authentication failed:", error);
      alert("Connection failed. Please refresh the page.");
      return;
    }
  }

  const roomCode = generateRoomCode();

  try {
    console.log("Creating room with code:", roomCode);
    
    // Check if room already exists first
    const roomRef = db.collection("rooms").doc(roomCode);
    const roomDoc = await roomRef.get();
    
    if (roomDoc.exists) {
      console.log("Room already exists, generating new code");
      // Try again with a new code
      createRoom();
      return;
    }

    const roomData = {
      host: currentUser.uid,
      players: {
        [currentUser.uid]: {
          name: playerName,
          score: 0,
          ready: false,
        },
      },
      gameState: "lobby",
      currentLetter: null,
      answers: {},
      roundComplete: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await roomRef.set(roomData);
    console.log("Room created successfully");

    currentRoom = roomCode;
    isHost = true;

    try {
      // Log room creation event
      analytics.logEvent('create_room', {
        userId: currentUser.uid,
        userName: playerName,
        roomCode: roomCode
      });
    } catch (analyticsError) {
      console.warn("Analytics error:", analyticsError);
      // Continue even if analytics fails
    }

    try {
      // Update user's game stats
      await db.collection('users').doc(currentUser.uid).set({
        lastGameAt: firebase.firestore.FieldValue.serverTimestamp(),
        gamesHosted: firebase.firestore.FieldValue.increment(1),
        currentRoom: roomCode
      }, { merge: true });
    } catch (statsError) {
      console.warn("Failed to update user stats:", statsError);
      // Continue even if stats update fails
    }

    setupRoomListener();
    showLobby();
  } catch (error) {
    console.error("Error creating room:", error);
    if (error.code === 'permission-denied') {
      alert("Permission denied. Please refresh the page and try again.");
    } else if (error.code === 'unavailable') {
      alert("Server is currently unavailable. Please try again in a few moments.");
    } else {
      alert("Failed to create room: " + error.message);
    }
  }
}

async function joinRoom() {
  try {
    // First ensure we have authentication
    if (!currentUser) {
      // Try to authenticate again
      const authResult = await auth.signInAnonymously();
      currentUser = authResult.user;
      console.log("Re-authenticated:", currentUser.uid);
    }

    const playerName = document.getElementById("joinPlayerName").value.trim();
    const roomCode = document
      .getElementById("roomCode")
      .value.trim()
      .toUpperCase();

    if (!playerName) {
      alert("Please enter your name!");
      return;
    }

    if (!roomCode || roomCode.length !== 4) {
      alert("Please enter a valid 4-letter room code!");
      return;
    }

    console.log("Attempting to join room:", roomCode);

    // Check if room exists
    const roomDoc = await db.collection("rooms").doc(roomCode).get();

    if (!roomDoc.exists) {
      alert("Room not found! Please check the code.");
      return;
    }

    const roomData = roomDoc.data();
    console.log("Room data:", roomData);

    if (Object.keys(roomData.players).length >= 10) {
      alert("Room is full! (Max 10 players)");
      return;
    }

    // Add player to room
    await db
      .collection("rooms")
      .doc(roomCode)
      .update({
        [`players.${currentUser.uid}`]: {
          name: playerName,
          score: 0,
          ready: false,
        },
      });

    console.log("Successfully joined room");

    // Update game state
    currentRoom = roomCode;
    isHost = false;

    // Log room join event
    analytics.logEvent('join_room', {
      userId: currentUser.uid,
      userName: playerName,
      roomCode: roomCode,
      playerCount: Object.keys(roomData.players).length
    });

    // Update user's game stats
    await db.collection('users').doc(currentUser.uid).set({
      lastGameAt: firebase.firestore.FieldValue.serverTimestamp(),
      gamesJoined: firebase.firestore.FieldValue.increment(1),
      currentRoom: roomCode
    }, { merge: true });

    // Show lobby screen first, then setup listener
    showLobby();
    setupRoomListener();

  } catch (error) {
    console.error("Error joining room:", error);
    if (error.code === 'permission-denied') {
      alert("Unable to join room. Please check your connection and try again.");
    } else {
      alert("Failed to join room: " + error.message);
    }
  }
}

function setupRoomListener() {
  // Clean up existing listener if any
  if (roomListener) {
    roomListener();
    roomListener = null;
  }

  if (!currentRoom) {
    console.error('No current room to listen to');
    return;
  }

  console.log('Setting up room listener for room:', currentRoom);

  try {
    roomListener = db
      .collection("rooms")
      .doc(currentRoom)
      .onSnapshot((doc) => {
        if (!doc.exists) {
          console.log('Room no longer exists');
          alert("Room was deleted!");
          showHome();
          return;
        }

        const roomData = doc.data();
        console.log('Room update received:', roomData);
        
        // Validate room data
        if (!roomData || !roomData.players) {
          console.error('Invalid room data received');
          return;
        }

        // Make sure player is still in the room
        if (!roomData.players[currentUser.uid]) {
          console.log('Player no longer in room');
          alert("You left the room");
          showHome();
          return;
        }

        updateGameState(roomData);
      }, (error) => {
        console.error('Room listener error:', error);
        alert("Lost connection to room. Please try rejoining.");
        showHome();
      });
  } catch (error) {
    console.error('Error setting up room listener:', error);
  }
}

function updateGameState(roomData) {
  const gameState = roomData.gameState;
  console.log("Updating game state to:", gameState, roomData);

  try {
    // Clear any existing timer if state is changing
    if (gameState !== "playing" && gameTimer) {
      clearInterval(gameTimer);
      gameTimer = null;
    }

    if (gameState === "lobby") {
      updateLobby(roomData);
    } else if (gameState === "playing") {
      updateGameScreen(roomData);
    } else if (gameState === "results") {
      updateResultsScreen(roomData);
    }
    
    // Update waiting status if in playing state
    if (gameState === "playing" && roomData.answers) {
      const playerCount = Object.keys(roomData.players || {}).length;
      const answerCount = Object.keys(roomData.answers || {}).length;
      const btnSubmit = document.getElementById("submitBtn");
      
      // Update submit button status based on whether this player has submitted
      if (btnSubmit) {
        if (roomData.answers[currentUser.uid]) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = `Waiting for other players... (${answerCount}/${playerCount})`;
        } else if (!btnSubmit.disabled) {
          btnSubmit.textContent = "Submit Answers";
        }
      }

      // If all players have submitted and this is the host, trigger results calculation
      if (answerCount >= playerCount && isHost && gameState === "playing") {
        calculateAndShowResults();
      }
    }
  } catch (error) {
    console.error("Error updating game state:", error);
  }
}

function showLobby() {
  // Create lobby screen container
  const body = document.body;
  body.innerHTML = `
    <div class="screen-wrapper">
      <div id="lobbyScreen" class="screen active">
        <div class="text-center">
          <h1><i class="fas fa-bullseye"></i> Super Nigga</h1>
          <h2>Game Lobby</h2>

          <div class="room-code" id="displayRoomCode">${currentRoom}</div>
          <p style="margin-bottom: 2rem; opacity: 0.8">
            Share this code with your super niggas!
          </p>

          <div class="players-list" id="playersList">
            <!-- Players will be dynamically added here -->
          </div>

          <div id="hostControls" class="text-center" style="display: none">
            <button class="btn" onclick="startGame()">
              <i class="fas fa-rocket"></i> Start Game
            </button>
          </div>

          <button class="btn btn-secondary" onclick="leaveRoom()">
            <i class="fas fa-sign-out-alt"></i> Leave Room
          </button>
        </div>
      </div>
    </div>
  `;

  console.log("Showing lobby, isHost:", isHost);
  const hostControls = document.getElementById("hostControls");
  if (isHost && hostControls) {
    console.log("Displaying host controls");
    hostControls.style.display = "block";
  }
  
  // Setup room listener after elements are created
  setupRoomListener();
}

function updateLobby(roomData) {
  const playersList = document.getElementById("playersList");
  if (!playersList) return; // Safety check

  playersList.innerHTML = "";

  if (!roomData || !roomData.players) return; // Safety check

  Object.entries(roomData.players).forEach(([uid, player]) => {
    const playerCard = document.createElement("div");
    playerCard.className = "player-card";
    playerCard.innerHTML = `
      <h3>${player.name}</h3>
      <p>Score: ${player.score}</p>
      ${
        uid === roomData.host
          ? '<p style="color: #ffd93d;"><i class="fas fa-crown"></i> Host</p>'
          : ""
      }
    `;
    playersList.appendChild(playerCard);
  });
}

async function startGame() {
  if (!isHost || !currentRoom) {
    console.log("Not authorized to start game or no room selected");
    return;
  }

  const randomLetter = String.fromCharCode(
    Math.floor(Math.random() * 26) + 65
  );

  try {
    console.log("Starting game in room:", currentRoom);
    const roomRef = db.collection("rooms").doc(currentRoom);
    
    // Verify room exists and user is host
    const roomDoc = await roomRef.get();
    if (!roomDoc.exists) {
      console.error("Room not found");
      alert("Room not found!");
      return;
    }
    
    const roomData = roomDoc.data();
    if (roomData.host !== currentUser.uid) {
      console.error("User is not host");
      return;
    }

    await roomRef.update({
      gameState: "playing",
      currentLetter: randomLetter,
      answers: {},
      roundComplete: false,
      gameStartTime: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log("Game started successfully");
  } catch (error) {
    console.error("Error starting game:", error);
    alert("Failed to start game. Please try again.");
  }
}

function updateGameScreen(roomData) {
  // Create game screen if it doesn't exist
  if (!document.getElementById("gameScreen")) {
    document.body.innerHTML = `
      <div class="screen-wrapper">
        <div id="gameScreen" class="screen">
          <div class="text-center">
            <div class="letter-display" id="currentLetter"></div>
            <div class="timer" id="timer">30</div>
            <div class="categories">
              ${categories.map(category => `
                <div class="category">
                  <div class="category-icon">${categoryIcons[category]}</div>
                  <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                  <input
                    type="text"
                    id="${category}Input"
                    placeholder="Enter ${category === 'thing' ? 'an' : 'a'} ${category}..."
                    maxlength="30"
                  />
                </div>
              `).join('')}
            </div>
            <button class="btn btn-success" id="submitBtn" onclick="submitAnswers()">
              Submit Answers
            </button>
          </div>
        </div>
      </div>
    `;
    setupGameInputListeners();
  }

  const gameScreenElement = document.getElementById("gameScreen");
  if (gameScreenElement.classList.contains("active")) {
    return; // Already on game screen
  }

  gameScreenElement.classList.add("active");
  document.getElementById("currentLetter").textContent = roomData.currentLetter;

  // Clear previous inputs
  categories.forEach((category) => {
    const input = document.getElementById(category + "Input");
    if (input) {
      input.value = "";
      input.disabled = false;
    }
  });

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.disabled = false;
  }

  startTimer();
}

function startTimer() {
  let timeLeft = 30;
  document.getElementById("timer").textContent = timeLeft;

  gameTimer = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;

    // Play tick sound for last 5 seconds
    if (timeLeft <= 5 && timeLeft > 0) {
      try {
        playSound("timer");
      } catch (e) {
        // Ignore audio errors
      }
    }

    // Change timer color for urgency
    const timerElement = document.getElementById("timer");
    if (timeLeft <= 10) {
      timerElement.style.color = "#ff6b6b";
      timerElement.style.animation = "pulse 0.5s infinite";
    } else {
      timerElement.style.color = "#ffd93d";
      timerElement.style.animation = "pulse 1s infinite";
    }

    if (timeLeft <= 0) {
      clearInterval(gameTimer);
      submitAnswers();
    }
  }, 1000);
}

async function submitAnswers() {
  try {
    if (gameTimer) {
      clearInterval(gameTimer);
    }

    const currentLetterElement = document.getElementById("currentLetter");
    if (!currentLetterElement) {
      console.error("Current letter element not found");
      return;
    }
    
    const answers = {};
    const currentLetter = currentLetterElement.textContent.toLowerCase();

    // Disable all inputs and submit button first
    const submitButton = document.getElementById("submitBtn");
    if (submitButton) {
      submitButton.disabled = true;
    }

    categories.forEach((category) => {
      const input = document.getElementById(category + "Input");
      if (!input) {
        console.error(`Input element for category ${category} not found`);
        return;
      }
      const value = input.value.trim();
      answers[category] = value;
      input.disabled = true;
    });

    // Submit answers to database with submission timestamp
    await db
      .collection("rooms")
      .doc(currentRoom)
      .update({
        [`answers.${currentUser.uid}`]: {
          ...answers,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      });

    console.log("Answers submitted successfully");

    // Update UI to show waiting state immediately
    if (submitButton) {
      submitButton.textContent = "Waiting for other players...";
    }

    if (isHost) {
      // If host, start checking for all submissions
      checkAllSubmissions();
    }
  } catch (error) {
    console.error("Error submitting answers:", error);
    // Re-enable inputs on error
    categories.forEach((category) => {
      const input = document.getElementById(category + "Input");
      if (input) {
        input.disabled = false;
      }
    });
    const submitButton = document.getElementById("submitBtn");
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function checkAllSubmissions() {
  if (!isHost) return;

  try {
    const roomRef = db.collection("rooms").doc(currentRoom);
    const checkSubmissions = async () => {
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return;

      const roomData = roomDoc.data();
      if (!roomData) return;

      const playerCount = Object.keys(roomData.players || {}).length;
      const answerCount = Object.keys(roomData.answers || {}).length;

      console.log(`Checking submissions: ${answerCount}/${playerCount}`);

      if (answerCount >= playerCount) {
        // All players have submitted, calculate results
        clearInterval(submissionCheckInterval);
        await calculateAndShowResults();
      }
    };

    // Check every second for new submissions
    const submissionCheckInterval = setInterval(checkSubmissions, 1000);
    // Also check immediately
    await checkSubmissions();

    // Clear interval after 35 seconds (5 seconds more than the timer) to prevent indefinite checking
    setTimeout(() => {
      clearInterval(submissionCheckInterval);
    }, 35000);
  } catch (error) {
    console.error("Error checking submissions:", error);
  }
}

async function calculateAndShowResults() {
  if (!isHost) return;

  try {
    console.log("Calculating results...");
    const roomRef = db.collection("rooms").doc(currentRoom);
    const roomDoc = await roomRef.get();
    
    if (!roomDoc.exists) {
      console.error("Room not found");
      return;
    }

    const roomData = roomDoc.data();
    if (!roomData) {
      console.error("Invalid room data");
      return;
    }

    const currentLetter = roomData.currentLetter.toLowerCase();
    const updatedPlayers = { ...roomData.players };
    const allAnswers = roomData.answers;
    
    // Initialize votes object if it doesn't exist
    if (!roomData.votes) {
      await roomRef.update({ votes: {} });
    }

    // For each category, check for duplicates and valid answers
    categories.forEach((category) => {
      const categoryAnswers = {};

      // Collect all answers for this category
      Object.entries(allAnswers).forEach(([uid, answers]) => {
        const answer = answers[category]?.toLowerCase().trim();
        // Check if answer is valid: starts with correct letter, has at least 2 characters, and is in dictionary
        // Names don't need dictionary validation
        const isInDictionary = category === "name" || validWords[category].has(answer);
        if (answer && 
            answer.startsWith(currentLetter) && 
            answer.length >= 2 &&
            isInDictionary) {
          if (!categoryAnswers[answer]) {
            categoryAnswers[answer] = [];
          }
          categoryAnswers[answer].push(uid);
        }
      });

      // Award points
      Object.entries(categoryAnswers).forEach(([answer, uids]) => {
        uids.forEach((uid) => {
          if (updatedPlayers[uid]) {
            updatedPlayers[uid].score += 10; // Base points
            if (uids.length === 1) {
              updatedPlayers[uid].score += 5; // Unique bonus
            }
          }
        });
      });
    });

    console.log("Updating game state with results...");
    await roomRef.update({
      players: updatedPlayers,
      gameState: "results",
      roundComplete: true,
    });
    console.log("Results updated successfully");
  } catch (error) {
    console.error("Error calculating results:", error);
  }
}

function updateResultsScreen(roomData) {
  console.log("Updating results screen with data:", roomData);
  
  // Create results screen if it doesn't exist
  if (!document.getElementById("resultsScreen")) {
    document.body.innerHTML = `
      <div class="screen-wrapper">
        <div id="resultsScreen" class="screen active">
          <div class="text-center">
            <h2>Round Results</h2>
            <div class="results-grid" id="resultsGrid"></div>
            <div class="leaderboard">
              <h2><i class="fas fa-trophy"></i> Leaderboard</h2>
              <div id="leaderboardList"></div>
            </div>
            <div id="hostNextRound" style="display: none">
              <button class="btn" onclick="nextRound()">
                <i class="fas fa-bullseye"></i> Next Round
              </button>
            </div>
            <button class="btn btn-secondary" onclick="endGame()">
              End Game
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const resultsGrid = document.getElementById("resultsGrid");
  const leaderboardList = document.getElementById("leaderboardList");

  if (!resultsGrid || !leaderboardList) {
    console.error("Results screen elements not found");
    return;
  }

  resultsGrid.innerHTML = "";
  leaderboardList.innerHTML = "";

  const currentLetter = roomData.currentLetter.toLowerCase();

  // Show player results
  Object.entries(roomData.players).forEach(([uid, player]) => {
    const playerResults = document.createElement("div");
    playerResults.className = "player-results";
    let resultsHTML = `
            <h3>${player.name} (Score: ${player.score})</h3>
        `;
    if (roomData.answers[uid]) {
      categories.forEach((category) => {
        const answer = roomData.answers[uid][category]?.trim() || "";
        const answerLower = answer.toLowerCase();
        const isInDictionary = category === "name" || validWords[category].has(answerLower);
        const votes = roomData.votes?.[uid]?.[category] || {};
        const voteCount = Object.values(votes).filter(v => v === true).length;
        const totalPlayers = Object.keys(roomData.players).length;
        const isValidByVotes = voteCount >= Math.ceil(totalPlayers / 2);
        const isValid = answerLower.startsWith(currentLetter) && 
                       answerLower.length >= 2 && 
                       (isInDictionary || isValidByVotes);
        const isUnique = isAnswerUnique(answer, category, uid, roomData.answers);
        let className = "";
        let points = "";
        let votingHtml = "";

        if (!answer) {
          className = "invalid-answer";
          points = "(0 pts)";
        } else if (!answerLower.startsWith(currentLetter)) {
          className = "invalid-answer";
          points = "(0 pts - wrong letter)";
        } else if (answerLower.length < 2) {
          className = "invalid-answer";
          points = "(0 pts - too short)";
        } else if (!isInDictionary && category !== "name" && !isValidByVotes) {
          className = "pending-validation";
          points = `(Votes: ${voteCount}/${Math.ceil(totalPlayers / 2)} needed)`;
          if (uid !== currentUser.uid) {
            votingHtml = `
              <div class="vote-buttons" data-uid="${uid}" data-category="${category}">
                <button onclick="voteAnswer('${uid}', '${category}', true)" ${votes[currentUser.uid] === true ? 'disabled' : ''}>
                  <i class="fas fa-check"></i>
                </button>
                <button onclick="voteAnswer('${uid}', '${category}', false)" ${votes[currentUser.uid] === false ? 'disabled' : ''}>
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `;
          }
        } else if (isValidByVotes || isInDictionary) {
          className = isUnique ? "unique-answer" : "duplicate-answer";
          points = isUnique ? "(15 pts)" : "(10 pts)";
        }

        resultsHTML += `
                <div class="answer-row">
                    <span>${
                      categoryIcons[category]
                    } ${category.charAt(0).toUpperCase() + category.slice(1)}:</span>
                    <span class="${className}">${answer || "No answer"} ${points}</span>
                    ${votingHtml}
                </div>
            `;
      });
    }
    playerResults.innerHTML = resultsHTML;
    resultsGrid.appendChild(playerResults);
  });

  // Show leaderboard
  const sortedPlayers = Object.entries(roomData.players).sort(
    ([, a], [, b]) => b.score - a.score
  );
  sortedPlayers.forEach(([uid, player], index) => {
    const leaderboardItem = document.createElement("div");
    leaderboardItem.className = "leaderboard-item";
    leaderboardItem.innerHTML = `
            <span class="rank">#${index + 1}</span>
            <span>${player.name}</span>
            <span class="score">${player.score} pts</span>
        `;
    leaderboardList.appendChild(leaderboardItem);
  });

  // Show host controls
  if (isHost) {
    document.getElementById("hostNextRound").style.display = "block";
  }
}

function isAnswerUnique(answer, category, uid, allAnswers) {
  if (!answer) return false;

  const normalizedAnswer = answer.toLowerCase().trim();
  let count = 0;

  Object.entries(allAnswers).forEach(([playerUid, answers]) => {
    const playerAnswer = answers[category]?.toLowerCase().trim();
    if (playerAnswer === normalizedAnswer) {
      count++;
    }
  });

  return count === 1;
}

async function nextRound() {
  if (!isHost) return;

  const randomLetter = String.fromCharCode(
    Math.floor(Math.random() * 26) + 65
  );

  try {
    await db.collection("rooms").doc(currentRoom).update({
      gameState: "playing",
      currentLetter: randomLetter,
      answers: {},
      roundComplete: false,
      gameStartTime: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error starting next round:", error);
    alert("Failed to start next round. Please try again.");
  }
}

async function leaveRoom() {
  if (currentRoom && currentUser) {
    try {
      if (isHost) {
        // If host leaves, delete the room
        await db.collection("rooms").doc(currentRoom).delete();
      } else {
        // Remove player from room
        await db
          .collection("rooms")
          .doc(currentRoom)
          .update({
            [`players.${currentUser.uid}`]:
              firebase.firestore.FieldValue.delete(),
          });
      }
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  }

  if (roomListener) {
    roomListener();
    roomListener = null;
  }

  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }

  currentRoom = null;
  isHost = false;
  showHome();
}

async function endGame() {
  if (confirm("Are you sure you want to end the game?")) {
    await leaveRoom();
  }
}

// Input validation and enhancements
document.getElementById("roomCode").addEventListener("input", function (e) {
  e.target.value = e.target.value.toUpperCase();
});

// Auto-focus next input when Enter is pressed
document.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    const activeElement = document.activeElement;

    if (activeElement.id === "playerName") {
      if (
        document.getElementById("homeScreen").classList.contains("active")
      ) {
        createRoom();
      }
    } else if (activeElement.id === "roomCode") {
      joinRoom();
    } else if (
      activeElement.classList.contains("category") ||
      activeElement.type === "text"
    ) {
      const inputs = document.querySelectorAll(
        '#gameScreen input[type="text"]'
      );
      const currentIndex = Array.from(inputs).indexOf(activeElement);

      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      } else {
        submitAnswers();
      }
    }
  }
});

// Add visual feedback for inputs
categories.forEach((category) => {
  const input = document.getElementById(category + "Input");
  input.addEventListener("input", function () {
    const currentLetter = document
      .getElementById("currentLetter")
      .textContent.toLowerCase();
    const value = this.value.toLowerCase().trim();

    if (value && value.startsWith(currentLetter) && value.length >= 2) {
      this.style.borderLeft = "4px solid #6bcf7f";
    } else if (value && value.startsWith(currentLetter)) {
      // Answer starts with correct letter but is too short
      this.style.borderLeft = "4px solid #ffd93d";
      this.title = "Answer must be at least 2 letters long";
    } else if (value) {
      this.style.borderLeft = "4px solid #ff6b6b";
    } else {
      this.style.borderLeft = "none";
      this.title = "";
    }
  });
});

// Cleanup on page unload
window.addEventListener("beforeunload", function () {
  if (currentRoom && currentUser) {
    leaveRoom();
  }
});

// Add sound effects (optional)
function playSound(type) {
  // Create audio context for sound effects
  const audioContext = new (window.AudioContext ||
    window.webkitAudioContext)();

  if (type === "timer") {
    // Timer tick sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.1
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } else if (type === "submit") {
    // Submit sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }
}

// Enhanced timer with sound
function startTimer() {
  let timeLeft = 30;
  document.getElementById("timer").textContent = timeLeft;

  gameTimer = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;

    // Play tick sound for last 5 seconds
    if (timeLeft <= 5 && timeLeft > 0) {
      try {
        playSound("timer");
      } catch (e) {
        // Ignore audio errors
      }
    }

    // Change timer color for urgency
    const timerElement = document.getElementById("timer");
    if (timeLeft <= 10) {
      timerElement.style.color = "#ff6b6b";
      timerElement.style.animation = "pulse 0.5s infinite";
    } else {
      timerElement.style.color = "#ffd93d";
      timerElement.style.animation = "pulse 1s infinite";
    }

    if (timeLeft <= 0) {
      clearInterval(gameTimer);
      submitAnswers();
    }
  }, 1000);
}

// Vote on an answer
async function voteAnswer(targetUid, category, vote) {
  if (!currentRoom || !currentUser || targetUid === currentUser.uid) return;

  try {
    const roomRef = db.collection("rooms").doc(currentRoom);
    
    // Update the votes in the database
    await roomRef.update({
      [`votes.${targetUid}.${category}.${currentUser.uid}`]: vote
    });

    // Get the updated room data
    const roomDoc = await roomRef.get();
    const roomData = roomDoc.data();
    
    // Check if majority vote is reached
    const votes = roomData.votes[targetUid][category];
    const voteCount = Object.values(votes).filter(v => v === true).length;
    const totalPlayers = Object.keys(roomData.players).length;
    
    // If majority approves, update player score
    if (voteCount >= Math.ceil(totalPlayers / 2)) {
      const answer = roomData.answers[targetUid][category].toLowerCase();
      const isUnique = isAnswerUnique(answer, category, targetUid, roomData.answers);
      const scoreIncrease = isUnique ? 15 : 10;
      
      await roomRef.update({
        [`players.${targetUid}.score`]: firebase.firestore.FieldValue.increment(scoreIncrease)
      });
    }
  } catch (error) {
    console.error("Error voting on answer:", error);
  }
}

// Initialize the app
console.log("ScatterWords initialized! 🎯");

// Setup game input listeners
function setupGameInputListeners() {
  categories.forEach((category) => {
    const input = document.getElementById(category + "Input");
    if (input) {
      input.addEventListener("input", function () {
        const currentLetter = document
          .getElementById("currentLetter")
          .textContent.toLowerCase();
        const value = this.value.toLowerCase().trim();

        if (value && value.startsWith(currentLetter)) {
          this.style.borderLeft = "4px solid #6bcf7f";
        } else if (value) {
          this.style.borderLeft = "4px solid #ff6b6b";
        } else {
          this.style.borderLeft = "none";
        }
      });

      input.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          const inputs = document.querySelectorAll('#gameScreen input[type="text"]');
          const currentIndex = Array.from(inputs).indexOf(this);
          if (currentIndex < inputs.length - 1) {
            inputs[currentIndex + 1].focus();
          } else {
            submitAnswers();
          }
        }
      });
    }
  });
}

// Show connection status
function showConnectionStatus() {
  const statusDiv = document.createElement("div");
  statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 1000;
        backdrop-filter: blur(10px);
    `;

  if (currentUser) {
    statusDiv.innerHTML = '<i class="fas fa-circle text-success"></i> Connected';
    statusDiv.style.background = "rgba(108, 207, 127, 0.8)";
  } else {
    statusDiv.innerHTML = '<i class="fas fa-circle text-warning"></i> Connecting...';
    statusDiv.style.background = "rgba(255, 217, 61, 0.8)";
  }

  document.body.appendChild(statusDiv);

  setTimeout(() => {
    statusDiv.remove();
  }, 3000);
}

// Show initial connection status
setTimeout(showConnectionStatus, 1000);

// Monitor auth state
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    console.log("User authenticated:", user.uid);
  } else {
    console.log("User signed out");
    currentUser = null;
  }
});