export type Tile = "#" | "S" | string;

export interface Maze {
  width: number;
  height: number;
  tiles: Tile[][];
}

export interface Player {
  id?: string; // Optional for backward compatibility
  x: number;
  y: number;
  renderX: number;
  renderY: number;
}

export type Role = "controller" | "subject" | null;

export interface ControllerViewport extends Player { }
