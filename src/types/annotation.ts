export type Point = {
  x: number;
  y: number;
};

export type RectangleAnnotation = {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type ArrowAnnotation = {
  type: "arrow";
  from: Point;
  to: Point;
  label?: string;
};

export type TextAnnotation = {
  type: "text";
  x: number;
  y: number;
  text: string;
};

export type RedactAnnotation = {
  type: "redact";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Annotation =
  | RectangleAnnotation
  | ArrowAnnotation
  | TextAnnotation
  | RedactAnnotation;
