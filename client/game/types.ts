export type Tile = "#" | "S" | string;

export interface Maze {
  width: number;
  height: number;
  tiles: Tile[][];
}

export interface Player {
  x: number;
  y: number;
  renderX: number;
  renderY: number;
}

export type Role = "controller" | "subject" | null;

export interface ControllerViewport extends Player {}