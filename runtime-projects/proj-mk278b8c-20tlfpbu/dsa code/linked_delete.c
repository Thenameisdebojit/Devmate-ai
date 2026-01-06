#include<stdio.h>
#include<stdlib.h>
struct Node{
    int data;
    struct Node* next;
};
struct Node* linkedTraversal(struct Node* ptr){
    while(ptr!=NULL){
        printf("element is %d\n", ptr->data);
        ptr=ptr->next;
    }
    return ptr;
}
struct Node* deleteAtFirst(struct Node* head){
    struct Node* ptr=head;
    head=head->next;
    free(ptr);
    return head;
}
struct Node* deleteAtIndex(struct Node* head, int index){
    struct Node* p=head;
    struct Node* q=head->next;
    int i=0;
    while(i!=index-1){
        p=p->next;
        q=q->next;

    }
    p->next=q->next;
    free(q);
    return head;
}
struct Node* deleteAtEnd(struct Node*head){
    struct Node*p=head;
    struct Node*q=head->next;
    while(q->next!=NULL){
        p=p->next;
        q=q->next;
    }
    p->next=NULL;
    free(q);
    return head;
}
struct Node* deleteAtvalue(struct Node* head, int value){
    struct Node* p=head;
    struct Node* q=head->next;
    while(q->data!=value && q->next!=NULL){
        p=p->next;
        q=q->next;
    }
    if(q->data==value){
        p->next=q->next;
        free(q);
    }
    return head;
}
int main(){
    struct Node* head=(struct Node*)malloc(sizeof(struct Node));
    struct Node* second=(struct Node*)malloc(sizeof(struct Node));
    struct Node* third=(struct Node*)malloc(sizeof(struct Node));
    struct Node* fourth=(struct Node*)malloc(sizeof(struct Node));

    head->data=23;
    head->next=second;

    second->data=67;
    second->next=third;

    third->data=89;
    third->next=fourth;

    fourth->data=99;
    fourth->next=NULL;
    printf("\n linked list before deletion\n");
    linkedTraversal(head);
    //head=deleteAtFirst(head);
    //head=deleteAtIndex(head,1);
    //head=deleteAtEnd(head);
    head=deleteAtvalue(head,89);
    printf("\n linked list after deletion\n");
    linkedTraversal(head);
}