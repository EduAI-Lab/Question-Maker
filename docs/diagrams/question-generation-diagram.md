```mermaid
flowchart TD
    Start([Initiate Generation Request]) --> 
    
    AIProcessing[AI processes Request]
    
    AIProcessing --> Review[Question returned<br/>for review]
    
    Review --> Edit{Review<br/>& Edit?}
    
    Edit -->|Needs changes| Review
    Edit -->|Approved| Save[Save to question bank]
    
    %% Styling - Black/White only with thick lines
    classDef default fill:#ffffff,stroke:#000000,stroke-width:4px,color:#000000
    classDef database fill:#f5f5f5,stroke:#000000,stroke-width:4px,color:#000000
```