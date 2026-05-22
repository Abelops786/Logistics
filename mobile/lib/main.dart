import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/app_provider.dart';
import 'screens/auth_screen.dart';
import 'screens/booking_screen.dart';
import 'screens/ledger_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final provider = AppProvider();
  await provider.loadSession();
  runApp(
    ChangeNotifierProvider.value(
      value: provider,
      child: const AbelDispatchApp(),
    ),
  );
}

class AbelDispatchApp extends StatelessWidget {
  const AbelDispatchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Abel Dispatch',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue.shade700),
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: Consumer<AppProvider>(
        builder: (context, provider, _) {
          if (!provider.isLoggedIn) return const AuthScreen();
          return const HomeShell();
        },
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  final _screens = const [BookingScreen(), LedgerScreen()];

  @override
  Widget build(BuildContext context) {
    final user = context.read<AppProvider>().user;
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Abel Dispatch', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(user?.name ?? '', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
        ]),
        backgroundColor: Colors.blue.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AppProvider>().logout(),
          ),
        ],
      ),
      body: _screens[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.add_box_outlined), selectedIcon: Icon(Icons.add_box), label: 'New Booking'),
          NavigationDestination(icon: Icon(Icons.history_outlined), selectedIcon: Icon(Icons.history), label: 'My Ledger'),
        ],
      ),
    );
  }
}
