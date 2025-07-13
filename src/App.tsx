// import { RouterProvider } from "react-router";
// import { Flowbite, ThemeModeScript } from 'flowbite-react';
// import customTheme from './utils/theme/custom-theme';
// import router from "./routes/Router";
// //import { RBACProvider } from './components/RBACSystem/rbacSystem';

// function App() {
//   return (
//     <>
//       <ThemeModeScript />
//         <Flowbite theme={{ theme: customTheme }}>
//           <RouterProvider router={router} />
//         </Flowbite>
//     </>
//   );
// }

// export default App;

import { RouterProvider } from "react-router";
import { Flowbite, ThemeModeScript } from 'flowbite-react';
import customTheme from './utils/theme/custom-theme';
import router from "./routes/Router";
import { DynamicRBACProvider } from './components/RBACSystem/rbacSystem'; // New system

function App() {
  return (
    <>
      <ThemeModeScript />
        <DynamicRBACProvider>
          <Flowbite theme={{ theme: customTheme }}>
            <RouterProvider router={router} />
          </Flowbite>
        </DynamicRBACProvider>
    </>
  );
}

export default App;