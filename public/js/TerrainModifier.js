import Easing from "./class/Easing.js";
import Brush from "./Brush.js";

const {
    Raycaster,
    Points,
    BufferAttribute,

    PointsMaterial,

    BufferGeometry
} = THREE;

export default class TerrainModifier {
    constructor(camera, meshs, points) {
        this.camera = camera;
        this.meshs = meshs;
        this.points = points;

        this.currentMode = [...TerrainModifier.BRUSH_EDIT_MODE][0];

        this.raycaster = new Raycaster();
        this.brush = new Brush(10);
        this.brushStrength = 0.3;
        this.brushSmoothness = 0.03;

        this.pointGeometry = new BufferGeometry();
        this.pointMaterial = new PointsMaterial({ color: 0xff0000, size: 0.5 });
        this.pointMesh = new Points(this.pointGeometry, this.pointMaterial);
        game.currentScene.add(this.pointMesh);
    }

    changePointColor(color) {
        this.pointMaterial.color.setHex(color);
    }

    changeBrushSize() {
        if (game.input.isKeyDown("ControlLeft")) {
            // console.log("left control down");
            const mouseDeltaX = game.input.getMouseDelta().x;
            const newSize = this.brush.size + mouseDeltaX * 20;
            this.brush.changeSize(newSize);
            // console.log(this.brush.size);
        }
    }

    getPointsInBrush() {
        if (game.input.isMouseButtonDown(1)) {
            this.clearPoints();

            return {};
        }
        const [intersect] = this.raycaster.intersectObject(this.meshs, false);
        if (typeof intersect !== "undefined") {
            let { point } = intersect;
            if (game.input.wasKeyJustPressed("ControlLeft")) {
                this.keepPointEditTerrain = point;
            }
            if (game.input.isKeyDown("ControlLeft")) {
                point = this.keepPointEditTerrain;
            }
            // console.log(point);

            const minX = Math.ceil(point.x - this.brush.size);
            // minX = minX < this.minX ? this.minX : minX;

            const minZ = Math.ceil(point.z - this.brush.size);
            // minZ = minZ < this.minZ ? this.minZ : minZ;

            const maxX = Math.floor(point.x + this.brush.size);
            // maxX = maxX > this.maxX ? this.maxX : maxX;

            const maxZ = Math.floor(point.z + this.brush.size);
            // maxZ = maxZ > this.maxZ ? this.maxZ : maxZ;

            // new to improve later with multiple plane
            const pointsArray = [];
            const pointsInBrush = [];
            const radiusSq = Math.pow(this.brush.size, 2);
            for (let x = minX; x <= maxX; x++) {
                if (typeof this.points[x] === "undefined") {
                    continue;
                }
                for (let z = minZ; z <= maxZ; z++) {
                    if (typeof this.points[x][z] === "undefined") {
                        continue;
                    }
                    const distance = Math.pow(x - point.x, 2) + Math.pow(z - point.z, 2);
                    if (distance <= radiusSq) {
                        pointsArray.push(x, this.points[x][z].y + 0.05, z);
                        pointsInBrush.push(this.points[x][z]);
                    }
                }
            }
            const vertices = new Float32Array(pointsArray);
            this.pointGeometry.addAttribute("position", new BufferAttribute(vertices, 3));

            return {
                brushPoint: point,
                pointsInBrush
            };
        }

        const vertices = new Float32Array([]);
        this.pointGeometry.addAttribute("position", new BufferAttribute(vertices, 3));

        return {};
    }


    raiseLower() {
        const { brushPoint, pointsInBrush = [] } = this.getPointsInBrush();
        let down = false;
        let lower = false;
        if (game.input.isMouseButtonDown(2)) {
            down = true;
            lower = true;
        }
        if (game.input.isMouseButtonDown(0) || down === true) {
            if (game.input.isKeyDown("ControlLeft")) {
                return;
            }
            const brushSizeSq = this.brush.size * this.brush.size;
            for (const point of pointsInBrush) {
                const distance = Math.pow(brushPoint.x - point.x, 2) + Math.pow(brushPoint.z - point.z, 2);

                const factor = 1 - distance / brushSizeSq;
                const easedFactor = Easing.smoothstep(0, 1, factor);

                // reprendre le plan geometrique
                const { index, object: geometry } = this.points[point.x][point.z];
                let newPosY = easedFactor * this.brushStrength;
                if (lower === true) {
                    newPosY = -newPosY;
                }
                geometry.attributes.position.array[index] += newPosY;
                this.points[point.x][point.z].y += newPosY;

                // try to see if we can update geometry if we switch for multiple plain
                geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    flatten() {
        const { brushPoint, pointsInBrush = [] } = this.getPointsInBrush();
        if (game.input.isMouseButtonDown(0)) {
            if (game.input.isKeyDown("ControlLeft")) {
                return;
            }

            for (const point of pointsInBrush) {
                const { index, object: geometry } = this.points[point.x][point.z];
                geometry.attributes.position.array[index] = brushPoint.y;
                this.points[point.x][point.z].y = brushPoint.y;

                // try to see if we can update geometry if we switch for multiple plain
                geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    smooth() {
        const { brushPoint, pointsInBrush = [] } = this.getPointsInBrush();
        if (game.input.isMouseButtonDown(0)) {
            if (game.input.isKeyDown("ControlLeft")) {
                return;
            }

            let total = 0;
            for (const point of pointsInBrush) {
                total += this.points[point.x][point.z].y;
            }

            const average = total / pointsInBrush.length;
            for (const point of pointsInBrush) {
                const { index, object: geometry } = this.points[point.x][point.z];

                const diff = this.points[point.x][point.z].y - average;
                if (diff === 0) {
                    continue;
                }

                const newPosY = this.brushSmoothness * -diff;
                geometry.attributes.position.array[index] += newPosY;
                this.points[point.x][point.z].y += newPosY;

                geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    clearPoints() {
        const vertices = new Float32Array([]);
        const buffer = new BufferAttribute(vertices, 3);
        this.pointGeometry.addAttribute("position", buffer);
    }

    update() {
        const mousePos = game.input.getMousePosition();
        this.raycaster.setFromCamera(mousePos, this.camera);
        this.changeBrushSize();
        if (game.input.wasKeyJustPressed("Digit1")) {
            this.changePointColor(0xff0000);
            this.clearPoints();
            this.currentMode = "Raise/Lower";
        }
        if (game.input.wasKeyJustPressed("Digit2")) {
            this.changePointColor(0x0000ff);
            this.clearPoints();
            this.currentMode = "Flatten";
        }
        if (game.input.wasKeyJustPressed("Digit3")) {
            this.changePointColor(0xff00ff);
            this.clearPoints();
            this.currentMode = "Smooth";
        }

        switch (this.currentMode) {
            case "Raise/Lower": {
                this.raiseLower();
                break;
            }
            case "Flatten": {
                this.flatten();
                break;
            }
            case "Smooth": {
                this.smooth();
                break;
            }
        }
    }
}
TerrainModifier.BRUSH_EDIT_MODE = new Set(["Raise/Lower", "Flatten", "Smooth"]);