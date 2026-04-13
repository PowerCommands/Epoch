Before implementing:
- Think through the architecture and how it integrates with TurnManager and CityManager
- Ensure event-driven design is preserved
- Avoid introducing tight coupling between systems



After implementing:
- Verify that the system reacts correctly to turnStart events
- Ensure resource updates propagate correctly to UI
- Check that future extensions (tile-based generation) are possible without refactor