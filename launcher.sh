#!/data/data/com.termux/files/usr/bin/bash

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m'
BOLD='\033[1m'

# Save project root directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

clear_screen() {
    clear
}

show_banner() {
    echo -e ""
    echo -e "  ${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}║                                              ║${NC}"
    echo -e "  ${GREEN}║${WHITE}${BOLD}     ⚽  TIKI TAKA TOE  ⚽                    ${NC}${GREEN}║${NC}"
    echo -e "  ${GREEN}║${DIM}     TikTok Live Football Grid Game           ${NC}${GREEN}║${NC}"
    echo -e "  ${GREEN}║                                              ║${NC}"
    echo -e "  ${GREEN}╠══════════════════════════════════════════════╣${NC}"
    echo -e "  ${GREEN}║                                              ║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[1]${NC}  Install Dependencies                  ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[2]${NC}  Generate Game Data (Scraper)          ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[3]${NC}  Generate Huge Puzzle Grids (7500+)    ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[4]${NC}  Extract Puzzle Data (from .zip)       ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[5]${NC}  Start Game (Backend + Frontend)       ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[6]${NC}  Full Setup (Install + Data + Start)   ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${CYAN}[7]${NC}  Install Termux Requirements           ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}   ${RED}[0]${NC}  Exit                                  ${GREEN}║${NC}"
    echo -e "  ${GREEN}║                                              ║${NC}"
    echo -e "  ${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

press_continue() {
    echo ""
    echo -e "  ${DIM}Press Enter to continue...${NC}"
    read -r
}

install_termux_deps() {
    clear_screen
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo -e "  ${WHITE}${BOLD} Installing Termux Requirements...${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}[1/3]${NC} Updating packages..."
    pkg update -y && pkg upgrade -y
    echo ""
    echo -e "  ${CYAN}[2/3]${NC} Installing Node.js & Git..."
    pkg install nodejs-lts git -y
    echo ""
    echo -e "  ${CYAN}[3/3]${NC} Verifying installation..."
    echo -e "  ${GREEN}✓${NC} Node.js: $(node -v 2>/dev/null || echo 'NOT INSTALLED')"
    echo -e "  ${GREEN}✓${NC} npm:     $(npm -v 2>/dev/null || echo 'NOT INSTALLED')"
    echo -e "  ${GREEN}✓${NC} Git:     $(git --version 2>/dev/null || echo 'NOT INSTALLED')"
    echo ""
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD} Termux requirements installed!${NC}"
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    press_continue
}

install_deps() {
    clear_screen
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo -e "  ${WHITE}${BOLD} Installing Dependencies...${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    cd "$PROJECT_DIR"
    echo -e "  ${CYAN}[1/3]${NC} Installing root dependencies..."
    npm install
    echo ""
    echo -e "  ${CYAN}[2/3]${NC} Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
    echo ""
    echo -e "  ${CYAN}[3/3]${NC} Installing scraper dependencies..."
    cd "$PROJECT_DIR/scraper"
    npm install
    echo ""
    cd "$PROJECT_DIR"
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD} All dependencies installed!${NC}"
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    press_continue
}

run_scraper() {
    clear_screen
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo -e "  ${WHITE}${BOLD} Generating Game Data...${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${DIM}Downloading player data & generating"
    echo -e "  puzzle grids. May take 1-3 minutes...${NC}"
    echo ""
    cd "$PROJECT_DIR/scraper"
    node index.js
    cd "$PROJECT_DIR"
    echo ""
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD} Game data generated successfully!${NC}"
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    press_continue
}

run_huge_scraper() {
    clear_screen
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo -e "  ${WHITE}${BOLD} Generating Huge Puzzle Grids...${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${DIM}Generating 7500+ grids from DuckDB."
    echo -e "  This might take a few minutes...${NC}"
    echo ""
    cd "$PROJECT_DIR/scraper"
    node build_from_duckdb.js
    cd "$PROJECT_DIR"
    echo ""
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD} Huge puzzles generated successfully!${NC}"
    echo -e "  ${GREEN}══════════════════════════════════════${NC}"
    press_continue
}

start_game() {
    clear_screen
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo -e "  ${WHITE}${BOLD} Start Tiki Taka Toe${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    echo -ne "  Enter TikTok username: ${CYAN}@${NC}"
    read -r username
    
    if [ -z "$username" ]; then
        echo -e "  ${RED}[!] Username cannot be empty!${NC}"
        sleep 2
        return
    fi
    
    echo ""
    echo -e "  ${GREEN}▶${NC} Starting game for ${CYAN}@${username}${NC}..."
    echo -e "  ${GREEN}▶${NC} Frontend: ${WHITE}http://localhost:5173${NC}"
    echo ""
    echo -e "  ${DIM}Press Ctrl+C to stop the game.${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    cd "$PROJECT_DIR"
    node start.js "$username"
    press_continue
}

full_setup() {
    clear_screen
    echo ""
    echo -e "  ${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}║${WHITE}${BOLD}         FULL SETUP - One Click Install       ${NC}${GREEN}║${NC}"
    echo -e "  ${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    
    cd "$PROJECT_DIR"
    echo -e "  ${CYAN}[Step 1/3]${NC} Installing dependencies..."
    echo -e "  ${DIM}────────────────────────────────────${NC}"
    npm install
    cd "$PROJECT_DIR/frontend" && npm install
    cd "$PROJECT_DIR/scraper" && npm install
    echo ""
    
    echo -e "  ${CYAN}[Step 2/3]${NC} Generating game data..."
    echo -e "  ${DIM}────────────────────────────────────${NC}"
    cd "$PROJECT_DIR/scraper"
    node index.js
    echo ""
    
    cd "$PROJECT_DIR"
    echo -e "  ${CYAN}[Step 3/3]${NC} Ready to launch!"
    echo -e "  ${DIM}────────────────────────────────────${NC}"
    echo ""
    echo -ne "  Enter TikTok username: ${CYAN}@${NC}"
    read -r username
    
    if [ -z "$username" ]; then
        echo -e "  ${RED}[!] Username cannot be empty!${NC}"
        sleep 2
        return
    fi
    
    echo ""
    echo -e "  ${GREEN}▶${NC} Starting game for ${CYAN}@${username}${NC}..."
    echo -e "  ${GREEN}▶${NC} Frontend: ${WHITE}http://localhost:5173${NC}"
    echo ""
    echo -e "  ${DIM}Press Ctrl+C to stop the game.${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    node start.js "$username"
    press_continue
}

extract_grids() {
    clear_screen
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo -e "  ${WHITE}${BOLD} Extracting Puzzle Data...${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════${NC}"
    echo ""
    cd "$PROJECT_DIR/data"
    local found=0
    for f in grids-easy.zip grids-medium.zip grids-hard.zip; do
        if [ -f "$f" ]; then
            echo -e "  ${CYAN}📦${NC} Extracting $f..."
            unzip -o "$f" 2>/dev/null || python -c "import zipfile; zipfile.ZipFile('$f').extractall('.')" 2>/dev/null
            found=1
        fi
    done
    if [ $found -eq 0 ]; then
        echo -e "  ${RED}[!] No .zip files found in data/ folder.${NC}"
        echo -e "  ${DIM}    Make sure grids-easy.zip, grids-medium.zip,${NC}"
        echo -e "  ${DIM}    and grids-hard.zip are in the data/ directory.${NC}"
    else
        echo ""
        echo -e "  ${GREEN}══════════════════════════════════════${NC}"
        echo -e "  ${GREEN}${BOLD} Puzzle data extracted successfully!${NC}"
        echo -e "  ${GREEN}══════════════════════════════════════${NC}"
        # Show file sizes
        for f in grids-easy.json grids-medium.json grids-hard.json; do
            if [ -f "$f" ]; then
                local size=$(du -h "$f" | cut -f1)
                echo -e "  ${GREEN}✓${NC} $f ($size)"
            fi
        done
    fi
    cd "$PROJECT_DIR"
    press_continue
}

# ─── Main Loop ───
while true; do
    clear_screen
    show_banner
    echo -ne "  ${WHITE}Select option ${CYAN}[0-7]${WHITE}: ${NC}"
    read -r choice
    
    case $choice in
        1) install_deps ;;
        2) run_scraper ;;
        3) run_huge_scraper ;;
        4) extract_grids ;;
        5) start_game ;;
        6) full_setup ;;
        7) install_termux_deps ;;
        0)
            clear_screen
            echo ""
            echo -e "  ${GREEN}Thanks for playing Tiki Taka Toe! ⚽${NC}"
            echo ""
            sleep 1
            exit 0
            ;;
        *)
            echo -e "  ${RED}[!] Invalid option. Try again.${NC}"
            sleep 1
            ;;
    esac
done
