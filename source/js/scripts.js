import attachFastClick from 'fastclick';
import iconAnimation from './components/iconAnimation';

const links = document.getElementsByClassName('social-link');

for(let i = 0; i < links.length; i++ ) {
  iconAnimation(links[i]);
}

//Initiate fastclick on body
attachFastClick(document.body);