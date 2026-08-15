export class ApiTaskCoordinator<TArgs extends unknown[]> {
  private sequence = 0;
  private active = true;
  private retryArguments: TArgs | null = null;

  begin(args: TArgs, retainForRetry: boolean): number {
    this.retryArguments = retainForRetry ? args : null;

    return ++this.sequence;
  }

  accepts(sequence: number): boolean {
    return this.active && sequence === this.sequence;
  }

  activate(): void {
    this.active = true;
  }

  retryArgs(): TArgs | null {
    return this.retryArguments;
  }

  hasRetry(): boolean {
    return this.retryArguments !== null;
  }

  reset(): void {
    this.sequence += 1;
    this.retryArguments = null;
  }

  dispose(): void {
    this.active = false;
    this.reset();
  }
}
