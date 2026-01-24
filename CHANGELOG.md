# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 0.0.1 (2026-01-24)


### Features

* add APK distribution page and integrate mobile app download link in Login ([cc6f80b](https://github.com/roonaatech/wp_webapp/commit/cc6f80be381a89d28d4f267a1d55e43449293063))
* add authentication information display and handling for user creation ([2190d36](https://github.com/roonaatech/wp_webapp/commit/2190d368a1ac4c1e0367a2ff6008262569ac0155))
* add environment configuration files for production and UAT ([ba5039d](https://github.com/roonaatech/wp_webapp/commit/ba5039dda1fe65d1866c56e90ddf9678c5252959))
* add incomplete profiles section to Dashboard and enhance Users page status filter ([7542a02](https://github.com/roonaatech/wp_webapp/commit/7542a02eb5d437af06eee00478b813e106c3b93f))
* add Mermaid.js for organizational chart visualization in Users page ([15ff6dd](https://github.com/roonaatech/wp_webapp/commit/15ff6dd225e119ca5a56bafaf33dc990797a586a))
* add sorting and letter filtering functionality to Users page ([bfbf84c](https://github.com/roonaatech/wp_webapp/commit/bfbf84cf4ffd4faf2d1a376b1230d79a90d1fdd7))
* add welcome modal for users with incomplete profile setup during login ([f7b4e95](https://github.com/roonaatech/wp_webapp/commit/f7b4e956659ec339e71c07bcd70b495272490eea))
* enhance APK download functionality with progress tracking and loading states ([b3955e3](https://github.com/roonaatech/wp_webapp/commit/b3955e3494f6de378651357de3ef27393d82c360))
* Enhance Approvals page with status color coding, improved UI components, and new icons for better user experience ([38aadaa](https://github.com/roonaatech/wp_webapp/commit/38aadaaa505bf9083fe72b877357fa78a9e3c898))
* Enhance login process with confirmation modal for local authentication and improved error handling ([f49bf82](https://github.com/roonaatech/wp_webapp/commit/f49bf82a1a584c9d5760d92f3857ca3a337a5249))
* Enhance Sidebar component with new icons, improved layout, and updated styles for better user experience ([c6bd573](https://github.com/roonaatech/wp_webapp/commit/c6bd573b9f5443769ba9822b26b8a2e83c25c84d))
* enhance user management access for managers and add pagination to users list ([3a95855](https://github.com/roonaatech/wp_webapp/commit/3a95855c9c3decf6ee82d420941de835bee45725))
* Implement a details modal for leave and on-duty requests, accessible by clicking table rows, and enhance the rejection modal's UI. ([e0a44ba](https://github.com/roonaatech/wp_webapp/commit/e0a44babd0ac43545e6204e81755d9d1f2d16fa8))
* Implement calculateLeaveDays utility function and update Approvals and Reports pages to use it for leave day calculations ([1c4b1cb](https://github.com/roonaatech/wp_webapp/commit/1c4b1cb0e003e378a36e1cf0b52af92251a2fc74))
* Implement theme switching functionality with new theme variables and update UI components for improved styling ([aaf87e4](https://github.com/roonaatech/wp_webapp/commit/aaf87e4e24c81fbd8db4af2fd9155d0d74de99da))
* Integrate react-hot-toast for enhanced user notifications across various components ([e3dc48c](https://github.com/roonaatech/wp_webapp/commit/e3dc48c0fa75a2744345abf59cb79b4dcffebff6))
* Introduce SVG brand logo component and enhance approvals page with confirmation modals and a dedicated reason column. ([d32a399](https://github.com/roonaatech/wp_webapp/commit/d32a3996d15581a4fbe3d8c8ebc43d54ff76537c))
* Replace generic report search input with a user-specific filter dropdown for reports. ([c9bdfa0](https://github.com/roonaatech/wp_webapp/commit/c9bdfa028de1845fdab1e7d01e89bfc7b3c07296))
* Replace Secure Access Badge with Copyright Info at the bottom of the Login page ([696884a](https://github.com/roonaatech/wp_webapp/commit/696884a77cfb678741f33b124644164b85d63ac9))
* Revamp leave balance display with improved layout and loading indicators in Users page ([7caee9d](https://github.com/roonaatech/wp_webapp/commit/7caee9d95305969182f1b7e70f9c9fc94b910b7c))
* set default role to Employee (3) when editing user if role is missing ([2a531c1](https://github.com/roonaatech/wp_webapp/commit/2a531c12db8eef18d76edac8d661f9fe68239994))
* update API configuration and refactor LeaveTypes to use centralized API_BASE_URL ([41d9008](https://github.com/roonaatech/wp_webapp/commit/41d900842fa93c93fb0b265d085424e3fa2bfd46))
* Update favicon and integrate BrandLogo component in the Header ([79b3202](https://github.com/roonaatech/wp_webapp/commit/79b320298e24ac69c901869896c7303165dcf163))
* update favicon link and add new SVG favicon for improved branding ([c24dc94](https://github.com/roonaatech/wp_webapp/commit/c24dc94a516e80494d2f54b56680b9f573545d23))
* Update favicon with new gradient design and implement BrandLogo component with enhanced SVG graphics ([80f6430](https://github.com/roonaatech/wp_webapp/commit/80f6430d3dd513cd2a2ce5d287cdc48068787ce7))
* Update Sidebar role badge styles and improve Approvals page request counts with pagination support ([ca5f3a8](https://github.com/roonaatech/wp_webapp/commit/ca5f3a82839b04aa6b01e098599b1fe3ad5f2743))
* Update status filter styles with improved color classes and borders for better visibility ([5d48830](https://github.com/roonaatech/wp_webapp/commit/5d488302cec41f6ded30d198e6ba5ab4749f6486))


### Documentation

* Update README with comprehensive project details and add .DS_Store. ([3bb5e9d](https://github.com/roonaatech/wp_webapp/commit/3bb5e9dc1910329bc2d5e008cf6dec9f4de641ae))


### Chores

* Add .gitignore and package-lock.json for project initialization. ([f8af477](https://github.com/roonaatech/wp_webapp/commit/f8af477612914df3dbb33176de242d254ff721e4))


### Styles

* Redesign the Login page with a modern two-column layout, updated UI elements, and a decorative panel. ([95ec363](https://github.com/roonaatech/wp_webapp/commit/95ec3635badd50b3fcf1372a839c57436c351204))


### Code Refactoring

* remove theme management from Header and ProtectedLayout components ([435b5bf](https://github.com/roonaatech/wp_webapp/commit/435b5bf26e45c44744667d9f82689922ffdaf5c3))
* Update application branding from ABiS WorkPulse to WorkPulse, refine UI text casing, and regenerate package-lock.json. ([7514fd4](https://github.com/roonaatech/wp_webapp/commit/7514fd4641f02244d130fa3bad249d5cc4a8305f))
