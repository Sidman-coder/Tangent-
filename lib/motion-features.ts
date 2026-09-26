// Split out so LazyMotion can fetch the animation/layout features as their own
// chunk after hydration instead of shipping them on every route's first load.
import { domMax } from "motion/react";

export default domMax;
