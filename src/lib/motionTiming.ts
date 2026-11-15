export const ROLL_DURATION=480;
export function movementDuration(distance:number){
 return Math.min(540,220+distance*25);
}
