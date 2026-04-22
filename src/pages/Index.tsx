// ... imports ...

const Index = ({ projects, housesData, setHousesData }: IndexProps) => {
  // ... state ...
  const activeProject = projects.find(p => p.id === selectedProjectId);

  return (
    // ... JSX ...
    <InteractiveMap 
      elements={activeProject.elements} 
      onHouseClick={handleElementClick} 
      selectedHouseId={selectedElementId} 
      housesData={housesData} 
      mapWidth={activeProject.mapWidth} 
      mapHeight={activeProject.mapHeight}
      centerX={activeProject.centerX}
      centerY={activeProject.centerY}
    />
    // ... rest of JSX ...
  );
};

export default Index;