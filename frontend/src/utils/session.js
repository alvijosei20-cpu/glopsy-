export const isLoggedIn = () => {
  return Boolean(localStorage.getItem('user'));
};
