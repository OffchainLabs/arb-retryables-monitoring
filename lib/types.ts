
export interface Result {
    testName: string;
    errors: string[];
    alerts: string[];
    info: string;
  }
  
  export interface Report {
    results: Result[];
    l1BlockNumber?: number;
    l2BlockNumber?: number;
    startTime: number;
    endTime: number;
    allGood: boolean;
    endBlock?: number 
    startBlock?: number
  }