import mojs from 'mo-js';

const iconAnimation = (iconLink) => {

  const scaleCurve = mojs.easing.path('M0,100 L25,99.9999983 C26.2328835,75.0708847 19.7847843,0 100,0');
  const el = iconLink,
    elSpan = el.querySelector('svg'),
  // mo.js timeline obj
    timeline = new mojs.Timeline(),

  // tweens for the animation:

  // ring animation
    tween2 = new mojs.Transit({
      parent: el,
      duration: 750,
      type: 'circle',
      radius: {0: 30},
      fill: 'transparent',
      stroke: 'red',
      strokeWidth: {15: 0},
      opacity: 0.6,
      x: '50%',
      y: '50%',
      isRunLess: true,
      easing: mojs.easing.bezier(0, 1, 0.5, 1),
    }),
  // icon scale animation
    tween3 = new mojs.Tween({
      duration: 900,
      onUpdate: (progress) => {
        const scaleProgress = scaleCurve(progress);
        elSpan.style.WebkitTransform = elSpan.style.transform = `scale3d(${scaleProgress},${scaleProgress},1)`;
      },
    });

  // add tweens to timeline:
  timeline.add(tween2, tween3);

  // when clicking the button start the timeline/animation:
  el.addEventListener('mouseenter', () => {
    timeline.start();
  });

};

export default iconAnimation;