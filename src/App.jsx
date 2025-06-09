import React, { useState, useEffect } from "react";
import InteractiveCourt from "./components/InteractiveCourt";
import PlayerGrid from "./components/PlayerGrid";
import StatTypeSelector from "./components/StatTypeSelector";
import GameRibbon from "./components/GameRibbon";
import ShotResultModal from "./components/ShotResultModal.jsx";
import TeamConfigPanel from "./components/TeamConfigPanel";
import Toast from "./Toast";



// helper function to convert hex to RGBA
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function App() {
  // ✅ useState must be inside App component
  const [teamConfig, setTeamConfig] = useState(() => {
    const saved = localStorage.getItem("snapstats_teamConfig");
    return saved
      ? JSON.parse(saved)
      : {
          home: {
            name: "Home",
            color: "#18bd0d",
            players: Array.from({ length: 12 }, (_, i) => i + 4)
          },
          away: {
            name: "Away",
            color: "#dc3545",
            players: Array.from({ length: 12 }, (_, i) => i + 4)
          }
        };

  });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [quarter, setQuarter] = useState(1);

  // Define state for configPanel visibility
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  

  // Helper functions for team score + fouls
  const getScoreForTeam = (team) => {
    return eventLog.reduce((sum, e) => {
      if (e.team === team && e.made) {
        if (e.statType === "3PT") return sum + 3;
        if (e.statType === "2PT") return sum + 2;
        if (e.statType === "FT") return sum + 1;
      }
      return sum;
    }, 0);
  };
  
  const getFoulsForTeam = (team) => {
    return eventLog.filter((e) => e.team === team && e.statType === "PF").length;
  };

  // Function to handle undo events
  const handleUndo = () => {
    if (eventLog.length === 0) return;
  
    const updatedLog = [...eventLog.slice(0, -1)];
    setEventLog(updatedLog);
    localStorage.setItem("snapstats_eventLog", JSON.stringify(updatedLog));
    setToastMsg("✅ Last action undone");
  };

  // Function to Export Game Data as json file
  const exportGameData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      teamConfig,
      eventLog,
    };
  
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
  
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapstats_game_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMsg("📤 Game exported");
  };
  

  // Shot Result Modal
  const [showModal, setShowModal] = useState(false);
  const [pendingZone, setPendingZone] = useState(null);
  
  // Toast functionality
  const [toastMsg, setToastMsg] = useState("");
  
  

  //Define stat logger function
  const logStatEvent = ({ zoneId = null, made = null, statOverride = null  }) => {
    if (!selectedPlayer || !(statOverride || selectedStat)) return;
  
    const newEvent = {
      type: "STAT",
      playerId: selectedPlayer.playerId,
      team: selectedPlayer.team,
      teamName: teamConfig[selectedPlayer.team].name, // team name as inserted in config panel
      statType: statOverride || selectedStat,
      zoneId,
      made,
      timestamp: Date.now(),
      quarter, // use dynamic quarter state
      metadata: {} // reserved for future use
    };

    console.log("Logged Event:", newEvent); // console logs in browser dev tools
  
    setEventLog((prev) => {
      const updated = [...prev, newEvent];
      localStorage.setItem("snapstats_eventLog", JSON.stringify(updated));
      return updated;
    });
    
  
    // Reset interaction
    setSelectedStat(null);
    
  };
  
  //Handle Court Taps for Shot Stats
  const handleZoneClick = (zoneId) => {
    if (selectedPlayer) {
      setPendingZone(zoneId);
      setShowModal(true);
    }
    
  /*  Old confirm.window logic for logging miss/made for shots
    const shotType = zoneId.includes("3") ? "3PT" : "2PT";
    const made = window.confirm(`${shotType} attempt — made? OK = Yes, Cancel = No`);
  
    logStatEvent({ zoneId, made, statOverride: shotType }); */
  };
  

  // ✅ Local storage hydration — must be inside App()
  useEffect(() => {
    const saved = localStorage.getItem("snapstats_eventLog");
    if (saved) {
      setEventLog(JSON.parse(saved));
    }
  }, []);

  // useEffect for teamConfig persistence
  useEffect(() => {
    localStorage.setItem("snapstats_teamConfig", JSON.stringify(teamConfig));
  }, [teamConfig]);
  


  

return (
    <div className="App" style={{ padding: "1rem", maxWidth:"100vw", overflowX:"hidden", margin: "0 auto" }}>

    {/* Game Ribbon & Burger Menu Sections */}
    <div className="GameRibbon" style={{ width: "100%",  maxWidth:"100vw", height: "auto"  }}>
	  <GameRibbon
	    homeScore={getScoreForTeam("home")}
	    awayScore={getScoreForTeam("away")}
	    homeFouls={getFoulsForTeam("home")}
	    awayFouls={getFoulsForTeam("away")}
	    quarter={quarter}
	    onQuarterChange={(delta) => {
	      setQuarter((prev) => {
	        const next = Math.max(1, Math.min(prev + delta, 4));
	        if (next !== prev) {
	          // Filter out PFs
	          setEventLog((prevLog) => {
	            const newLog = prevLog.filter((e) => e.statType !== "PF");
	            localStorage.setItem("snapstats_eventLog", JSON.stringify(newLog));
	            return newLog;
	          });
	        }
	        return next;
	      });
	    }}
	    onToggleConfig={() => setShowConfigPanel(prev => !prev)}
	    homeColor={teamConfig.home.color}
	    awayColor={teamConfig.away.color}
	    
	    
	  />
	  
	  {/* configPanel with click-outside handler */}
	  {showConfigPanel && (
	    <div
	      onClick={(e) => {
	        if (e.target.id === "config-backdrop") {
	          setShowConfigPanel(false);
	        }
	      }}
	      onKeyDown={(e) => {
	        if (e.key === "Escape") {
	          setShowConfigPanel(false);
	        }
	      }}
	      tabIndex={-1}
	      id="config-backdrop"
	      style={{
	        position: "fixed",
	        top: 0,
	        left: 0,
	        width: "100vw",
	        height: "100vh",
	        background: "rgba(0,0,0,0.2)",
	        zIndex: 1000,
	      }}
	    >
	      <TeamConfigPanel
	        teamConfig={teamConfig}
	        setTeamConfig={setTeamConfig}
	      />
	    </div>
	  )}
	  
	  </div>


	  

	  <div className="court-wrapper" style={{ 
	  									width: "100vw",  
	  									maxWidth:"100%", 
	  									height: "auto", 
	  									position:"relative", 
	  									overflow: "hidden",
	  									top: "0px"  }}>

      <InteractiveCourt onZoneClick={handleZoneClick} />
      </div>

      {/* Stat Selector Grid */}	
      <div
        style={{
          
          justifyContent: "space-between",
          marginTop: "0.5rem",
          width: "100%"
        }}
      >
      <StatTypeSelector
              selectedStat={selectedStat}
              onSelect={(statType) => {
                setSelectedStat(statType);
            
                if (statType === "FT" && selectedPlayer) {
                  setPendingZone(null);
                  setSelectedStat("FT");
                  setShowModal(true);
                }
                
            
                if (
                  !["FT", "2PT", "3PT"].includes(statType) &&
                  selectedPlayer
                ) {
                  logStatEvent({ statOverride: statType });
                }
              }}
            />

      

      </div>
      
  
	  {/* Home + Away PlayerGrids */}	
	  <div
	    style={{
	      display: "flex",
	      justifyContent: "space-between",
	      marginTop: "1rem",
	      width: "100%"
	    }}
	  >
	  
	  <div style={{ width: "50%" }}>
      <PlayerGrid
        team="home"
        config={teamConfig.home}
        selectedPlayer={selectedPlayer}
        onSelect={setSelectedPlayer}
        backgroundTint={hexToRGBA(teamConfig.home.color, 0.18)} // changes dynamically with color picked in config panel
        onEdit={(newPlayers) =>
          setTeamConfig((prev) => ({
            ...prev,
            home: { ...prev.home, players: newPlayers }
          }))
        }
      />
      </div>

      <div style={{ width: "50%" }}>
      <PlayerGrid
        team="away"
        config={teamConfig.away}
        selectedPlayer={selectedPlayer}
        onSelect={setSelectedPlayer}
        backgroundTint={hexToRGBA(teamConfig.away.color, 0.18)} // changes dynamically with color picked in config panel
        onEdit={(newPlayers) =>
          setTeamConfig((prev) => ({
            ...prev,
            away: { ...prev.away, players: newPlayers }
          }))
        }
      />
      </div>
  

      </div>

      {/* Stat Result Modal */}
      {showModal && (
        <ShotResultModal
          onSelect={(made) => {
            const shotType =
              selectedStat === "FT" ? "FT" :
              pendingZone?.includes("3") ? "3PT" : "2PT";
        
            logStatEvent({
              zoneId: pendingZone, // null for FT
              made,
              statOverride: shotType
            });
        
            setShowModal(false);
            setPendingZone(null);
          }}
          onCancel={() => {
              setShowModal(false);
              setPendingZone(null);
              setSelectedStat(null); // ⬅️ this clears FT lock
            }}
        />
        
      )}

      {/* Buttons data export, undo action and  reseting game */}
	  <div style= {{
	  	display: "flex",
	  	justifyContent: "space-between",
	  	width: "100%",
	  	marginTop: "1rem", // optional spacing
	  	gap: "0.5rem", //option for minor breathing room if needed
	  }}>
      <button
        onClick={exportGameData}
        style={{
          padding: "0.5rem 1rem",
          border: "1px solid #ccc",
          borderRadius: "4px",
          
        }}
      >
        Export Game
      </button>
           
      <button
        onClick={() => {
          if (window.confirm("Reset all logged events?")) {
            localStorage.removeItem("snapstats_eventLog");
            setEventLog([]);
            setQuarter(1); // reset quarter as well
            setToastMsg("♻️ Game reset");
          }
        }}
        style={{
          
          padding: "0.5rem 1rem",
          backgroundColor: "#dc3545",
          color: "white",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Reset Game
      </button>

      <button
        onClick={handleUndo}
        style={{
          
          padding: "0.5rem 1rem",
          backgroundColor: "#6c757d",
          color: "white",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Undo Last
      </button>
      
      {/* Adding Toast Component to the Render Tree */}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg("")} />}
      
  	</div>

  	
      {/* 🧪 Event Log */}
      <div style={{ marginTop: "1rem" }}>
        <h4>Event Log:</h4>
        <ul>
          {[...eventLog].reverse().map((event, index) => (
            <li key={index}>
              <span
                  style={{
                    color: event.team === "home" ? teamConfig.home.color : teamConfig.away.color,
                    fontWeight: "bold",
                  }}
                >
                 #{event.playerId}
              </span>{" "}
              | {event.statType}{" "}
              {event.zoneId ? `@ ${event.zoneId}` : ""}{" "}
              {event.made !== null ? (event.made ? "✅" : "❌") : ""}
            </li>
          ))}
        </ul>
      </div>

      
      
      
    </div>
  );
  
  
}

export default App;
