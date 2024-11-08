/**
 * Mulberry32 random number generator
 * @returns {Function} Random number generator function
 */
function mulberry32() {
    return function () {
        let t = CONFIG.randomSeed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}


/**
 * Creates and configures an SVG element
 * @returns {SVGElement} Configured SVG element
 */
function createSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", CONFIG.width);
    svg.setAttribute("height", CONFIG.height);
    return svg;
}

/**
 * Creates a border rectangle for the SVG
 * @returns {SVGRectElement} Border rectangle element
 */
function createBorder() {
    const border = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    border.setAttribute("x", "0");
    border.setAttribute("y", "0");
    border.setAttribute("width", CONFIG.width);
    border.setAttribute("height", CONFIG.height);
    border.setAttribute("fill", "none");
    border.setAttribute("stroke", CONFIG.borderColor);
    border.setAttribute("stroke-width", CONFIG.borderWidth);
    return border;
}

/**
 * Creates a single dot with random position and velocity
 * @returns {Object} Dot object with element and physics properties
 */
function spawnRandomDot() {

    let random;
    if (CONFIG.randomSeed == 0) {
        random = Math.random;
    } else {
        random = mulberry32();
    }

    const dot = {
        element: document.createElementNS("http://www.w3.org/2000/svg", "circle"),
        x: random() * (CONFIG.width - 2 * CONFIG.dotRadius) + CONFIG.dotRadius,
        y: random() * (CONFIG.height - 2 * CONFIG.dotRadius) + CONFIG.dotRadius,
        vx: (random() - 0.5) * CONFIG.maxSpeed,
        vy: (random() - 0.5) * CONFIG.maxSpeed
    };

    dot.element.setAttribute("r", CONFIG.dotRadius);
    dot.element.setAttribute("fill", CONFIG.dotColor);
    return dot;
}

/**
 * Spawns a specified number of random dots
 * @returns {Array} Array of dot objects
 */
function spawnDots() {
    const dots = [];
    for (let i = 0; i < CONFIG.numDots; i++) {
        const dot = spawnRandomDot(i);
        svg.appendChild(dot.element);
        dots.push(dot);
    }
    return dots;
}

/**
 * Draws connection lines between dots
 */
function drawConnections(linesGroup, dots) {
    // Track number of connections per dot
    const connectionCounts = new Array(dots.length).fill(0);

    // Calculate all possible connections and their distances
    const connections = [];
    for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
            const dx = dots[i].x - dots[j].x;
            const dy = dots[i].y - dots[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= CONFIG.connectionThreshold) {
                connections.push({
                    dot1: i,
                    dot2: j,
                    distance: distance
                });
            }
        }
    }

    if (CONFIG.maxConnectionsPerDot != 0) {
        // Sort connections by distance (closest first)
        connections.sort((a, b) => a.distance - b.distance);

        // Draw connections while respecting max connections per dot
        for (const conn of connections) {
            if (connectionCounts[conn.dot1] < CONFIG.maxConnectionsPerDot &&
                connectionCounts[conn.dot2] < CONFIG.maxConnectionsPerDot) {
                const line = createConnectionLine(dots[conn.dot1], dots[conn.dot2]);
                linesGroup.appendChild(line);
                connectionCounts[conn.dot1]++;
                connectionCounts[conn.dot2]++;
            }
        }
    } else {
        // Draw all connections within threshold when limt is 0
        for (const conn of connections) {
            const line = createConnectionLine(dots[conn.dot1], dots[conn.dot2]);
            linesGroup.appendChild(line);
        }
    }
}

/**
 * Clears all connection lines
 */
function clearConnections(linesGroup) {
    while (linesGroup.firstChild) {
        linesGroup.removeChild(linesGroup.firstChild);
    }
}

/**
 * Handles collision between two dots
 * @param {Object} dot1 First dot
 * @param {Object} dot2 Second dot
 */
function handleDotCollision(dot1, dot2) {
    const dx = dot1.x - dot2.x;
    const dy = dot1.y - dot2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = CONFIG.dotRadius * 2;

    if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Rotate velocities
        const vx1 = dot1.vx * cos + dot1.vy * sin;
        const vy1 = dot1.vy * cos - dot1.vx * sin;
        const vx2 = dot2.vx * cos + dot2.vy * sin;
        const vy2 = dot2.vy * cos - dot2.vx * sin;

        // Swap the rotated velocities
        dot1.vx = vx2 * cos - vy1 * sin;
        dot1.vy = vy1 * cos + vx2 * sin;
        dot2.vx = vx1 * cos - vy2 * sin;
        dot2.vy = vy2 * cos + vx1 * sin;

        // Move dots apart to prevent sticking
        const overlap = minDistance - distance;
        const moveX = (overlap * dx) / distance / 2;
        const moveY = (overlap * dy) / distance / 2;
        dot1.x += moveX;
        dot1.y += moveY;
        dot2.x -= moveX;
        dot2.y -= moveY;
    }
}

/**
 * Updates dot position and handles wall collisions
 * @param {Object} dot Dot to update
 */
function updateDotPosition(dot) {
    // Apply friction
    if (CONFIG.friction > 0) {
        dot.vx *= 1 - CONFIG.friction;
        dot.vy *= 1 - CONFIG.friction;
    }

    if (CONFIG.acceleration > 0) {
        dot.vx *= CONFIG.acceleration;
        dot.vy *= CONFIG.acceleration;
    }

    // Update position
    dot.x = dot.x + dot.vx;
    dot.y = dot.y + dot.vy;

    // Handle wall collisions
    // Check if dot hits left (x < 0) or right (x > width) walls
    if (dot.x - CONFIG.dotRadius < 0 || dot.x + CONFIG.dotRadius > CONFIG.width) {
        // Reverse horizontal velocity
        dot.vx *= -1;
        // Clamp x position to keep dot within bounds
        // Math.max prevents going past left wall, Math.min prevents going past right wall
        dot.x = Math.max(CONFIG.dotRadius, Math.min(CONFIG.width - CONFIG.dotRadius, dot.x));
    }
    // Check if dot hits top (y < 0) or bottom (y > height) walls 
    if (dot.y - CONFIG.dotRadius < 0 || dot.y + CONFIG.dotRadius > CONFIG.height) {
        // Reverse vertical velocity
        dot.vy *= -1;
        // Clamp y position to keep dot within bounds
        // Math.max prevents going past top wall, Math.min prevents going past bottom wall
        dot.y = Math.max(CONFIG.dotRadius, Math.min(CONFIG.height - CONFIG.dotRadius, dot.y));
    }

    // Update visual position
    dot.element.setAttribute("cx", dot.x);
    dot.element.setAttribute("cy", dot.y);
}

/**
 * Creates a connection line between two dots
 * @param {Object} dot1 First dot
 * @param {Object} dot2 Second dot
 * @returns {SVGLineElement} Line element connecting the dots
 */
function createConnectionLine(dot1, dot2) {
    const dx = dot1.x - dot2.x;
    const dy = dot1.y - dot2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", dot1.x);
    line.setAttribute("y1", dot1.y);
    line.setAttribute("x2", dot2.x);
    line.setAttribute("y2", dot2.y);
    line.setAttribute("stroke", CONFIG.connectionColor);
    line.setAttribute("stroke-width", CONFIG.connectionWidth);
    line.setAttribute("opacity", 1 - (distance / CONFIG.connectionThreshold));
    return line;
}

// Initialize SVG and its components
const svg = createSVG();
svg.appendChild(createBorder());

// Create dots
const dots = spawnDots();

// Create lines group
const linesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
svg.insertBefore(linesGroup, svg.firstChild);

/**
 * Main animation loop
 */
function animate(timestamp) {
    // Calculate frame time and FPS
    // if (animate.lastTimestamp) {
    //     const frameTime = timestamp - animate.lastTimestamp;
    //     const fps = 1000 / frameTime;
    //     time = {
    //         frameTime: frameTime.toFixed(2) + 'ms',
    //         FPS: fps.toFixed(1)
    //     }
    //     console.table(time);
    // }
    // animate.lastTimestamp = timestamp;

    // Update dot positions and handle collisions
    dots.forEach((dot, idx) => {
        if (CONFIG.dotCollision) {
            dots.forEach((otherDot, otherIdx) => {
                // Dot's don't touch themselves
                if (idx !== otherIdx) {
                    handleDotCollision(dot, otherDot);
                }
            });
        }
        if (CONFIG.animate) {
            updateDotPosition(dot);
        }
    });

    // Clear and redraw connection lines
    if (CONFIG.connections) {
        clearConnections(linesGroup);
        drawConnections(linesGroup, dots);
    }

    // Request next frame
    requestAnimationFrame(animate);
}

// Start animation
document.getElementById("container").appendChild(svg);
animate();