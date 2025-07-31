// Firebase configuration - Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCg5F2_5C9dnl2oCj2ad9gxsxdPWRbcaOs",
  authDomain: "omoshiroi-8487c.firebaseapp.com",
  projectId: "omoshiroi-8487c",
  storageBucket: "omoshiroi-8487c.firebasestorage.app",
  messagingSenderId: "200240035047",
  appId: "1:200240035047:web:87dae58b97ef25044a5e42",
  measurementId: "G-2Z21WPFC9C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

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

// Initialize anonymous authentication
auth
  .signInAnonymously()
  .then((result) => {
    currentUser = result.user;
    console.log("Signed in anonymously:", currentUser.uid);
  })
  .catch((error) => {
    console.error("Authentication failed:", error);
    alert("Failed to connect. Please refresh the page.");
  });

// Screen management
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
}

function showHome() {
  showScreen("homeScreen");
}

function showJoinRoom() {
  showScreen("joinScreen");
  document.getElementById("roomCode").focus();
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
    alert("Please wait for connection...");
    return;
  }

  const roomCode = generateRoomCode();

  try {
    await db
      .collection("rooms")
      .doc(roomCode)
      .set({
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
      });

    currentRoom = roomCode;
    isHost = true;
    setupRoomListener();
    showLobby();
  } catch (error) {
    console.error("Error creating room:", error);
    alert("Failed to create room. Please try again.");
  }
}

async function joinRoom() {
  const playerName = document.getElementById("playerName").value.trim();
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

  if (!currentUser) {
    alert("Please wait for connection...");
    return;
  }

  try {
    const roomDoc = await db.collection("rooms").doc(roomCode).get();

    if (!roomDoc.exists) {
      alert("Room not found! Please check the code.");
      return;
    }

    const roomData = roomDoc.data();
    if (Object.keys(roomData.players).length >= 8) {
      alert("Room is full! (Max 8 players)");
      return;
    }

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

    currentRoom = roomCode;
    isHost = false;
    setupRoomListener();
    showLobby();
  } catch (error) {
    console.error("Error joining room:", error);
    alert("Failed to join room. Please try again.");
  }
}

function setupRoomListener() {
  if (roomListener) {
    roomListener();
  }

  roomListener = db
    .collection("rooms")
    .doc(currentRoom)
    .onSnapshot((doc) => {
      if (!doc.exists) {
        alert("Room was deleted!");
        showHome();
        return;
      }

      const roomData = doc.data();
      updateGameState(roomData);
    });
}

function updateGameState(roomData) {
  const gameState = roomData.gameState;

  if (gameState === "lobby") {
    updateLobby(roomData);
  } else if (gameState === "playing") {
    updateGameScreen(roomData);
  } else if (gameState === "results") {
    updateResultsScreen(roomData);
  }
}

function showLobby() {
  showScreen("lobbyScreen");
  document.getElementById("displayRoomCode").textContent = currentRoom;

  if (isHost) {
    document.getElementById("hostControls").style.display = "block";
  }
}

function updateLobby(roomData) {
  const playersList = document.getElementById("playersList");
  playersList.innerHTML = "";

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
    console.error("Error starting game:", error);
    alert("Failed to start game. Please try again.");
  }
}

function updateGameScreen(roomData) {
  if (
    document.getElementById("gameScreen").classList.contains("active")
  ) {
    return; // Already on game screen
  }

  showScreen("gameScreen");
  document.getElementById("currentLetter").textContent =
    roomData.currentLetter;

  // Clear previous inputs
  categories.forEach((category) => {
    document.getElementById(category + "Input").value = "";
    document.getElementById(category + "Input").disabled = false;
  });

  document.getElementById("submitBtn").disabled = false;
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
  if (gameTimer) {
    clearInterval(gameTimer);
  }

  const answers = {};
  const currentLetter = document
    .getElementById("currentLetter")
    .textContent.toLowerCase();

  categories.forEach((category) => {
    const input = document.getElementById(category + "Input");
    const value = input.value.trim();
    answers[category] = value;
    input.disabled = true;
  });

  document.getElementById("submitBtn").disabled = true;

  try {
    await db
      .collection("rooms")
      .doc(currentRoom)
      .update({
        [`answers.${currentUser.uid}`]: answers,
      });

    // Check if all players have submitted
    const roomDoc = await db.collection("rooms").doc(currentRoom).get();
    const roomData = roomDoc.data();
    const playerCount = Object.keys(roomData.players).length;
    const answerCount = Object.keys(roomData.answers).length;

    if (answerCount >= playerCount && isHost) {
      // All players submitted, calculate scores
      calculateAndShowResults();
    }
  } catch (error) {
    console.error("Error submitting answers:", error);
  }
}

async function calculateAndShowResults() {
  if (!isHost) return;

  try {
    const roomDoc = await db.collection("rooms").doc(currentRoom).get();
    const roomData = roomDoc.data();
    const currentLetter = roomData.currentLetter.toLowerCase();

    // Calculate scores
    const updatedPlayers = { ...roomData.players };
    const allAnswers = roomData.answers;

    // For each category, check for duplicates and valid answers
    categories.forEach((category) => {
      const categoryAnswers = {};

      // Collect all answers for this category
      Object.entries(allAnswers).forEach(([uid, answers]) => {
        const answer = answers[category]?.toLowerCase().trim();
        if (answer && answer.startsWith(currentLetter)) {
          if (!categoryAnswers[answer]) {
            categoryAnswers[answer] = [];
          }
          categoryAnswers[answer].push(uid);
        }
      });

      // Award points
      Object.entries(categoryAnswers).forEach(([answer, uids]) => {
        uids.forEach((uid) => {
          updatedPlayers[uid].score += 10; // Base points
          if (uids.length === 1) {
            updatedPlayers[uid].score += 5; // Unique bonus
          }
        });
      });
    });

    await db.collection("rooms").doc(currentRoom).update({
      players: updatedPlayers,
      gameState: "results",
      roundComplete: true,
    });
  } catch (error) {
    console.error("Error calculating results:", error);
  }
}

function updateResultsScreen(roomData) {
  showScreen("resultsScreen");

  const resultsGrid = document.getElementById("resultsGrid");
  const leaderboardList = document.getElementById("leaderboardList");

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
        const isValid = answer.toLowerCase().startsWith(currentLetter);
        const isUnique = isAnswerUnique(answer, category, uid, roomData.answers);
        let className = "";
        let points = "";
        if (!answer) {
          className = "invalid-answer";
          points = "(0 pts)";
        } else if (!isValid) {
          className = "invalid-answer";
          points = "(0 pts)";
        } else if (isUnique) {
          className = "unique-answer";
          points = "(15 pts)";
        } else {
          className = "duplicate-answer";
          points = "(10 pts)";
        }
        resultsHTML += `
                <div class="answer-row">
                    <span>${
                      categoryIcons[category]
                    } ${category.charAt(0).toUpperCase() + category.slice(1)}:</span>
                    <span class="${className}">${answer || "No answer"} ${points}</span>
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

    if (value && value.startsWith(currentLetter)) {
      this.style.borderLeft = "4px solid #6bcf7f";
    } else if (value) {
      this.style.borderLeft = "4px solid #ff6b6b";
    } else {
      this.style.borderLeft = "none";
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

// Initialize the app
console.log("ScatterWords initialized! 🎯");

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